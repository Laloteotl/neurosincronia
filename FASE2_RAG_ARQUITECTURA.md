# NEUROSINCRONIA — FASE 2: RAG + BASE DE CONOCIMIENTO
> Documento de arquitectura. Actualizar conforme avance el diseño.

---

## Objetivo

Conectar el agente terapéutico con una base de conocimiento vectorizada a partir de notas de Obsidian (tesis, teoría clínica, neurología) para que las respuestas estén fundamentadas en fuentes reales, no solo en el modelo base.

---

## Stack recomendado (sin backend propio)

| Capa | Opción A (gratuita/self-hosted) | Opción B (hosted, más simple) |
|---|---|---|
| Embeddings | `all-MiniLM-L6-v2` (HuggingFace, local) | Anthropic Embeddings API |
| Vector store | **Chroma** (local, exportable a JSON) | Pinecone free tier |
| Pipeline Obsidian→vectores | Script Python local | - |
| Búsqueda en frontend | fetch a Chroma server local / JSON estático | Pinecone REST API |
| Hosting | GitHub Pages (RAG estático) | Cloudflare Workers |

**Recomendación:** Opción A para desarrollo, JSON estático exportado a GitHub Pages para producción. Cero costos, funciona offline.

---

## Estructura del vault de Obsidian

Organizar las notas en carpetas por dominio antes de vectorizar:

```
/vault-neurosincronia/
  /neurodivergencias/
    tdah-adultos.md
    autismo-doble-excepcionalidad.md
    dislexia-discalculia.md
    sindrome-tourette.md
  /psicologia-clinica/
    tcc-fundamentos.md
    act-terapia-aceptacion.md
    dbt-regulacion-emocional.md
    jung-arquetipos.md
    freud-defensa.md
  /neurologia/
    sistema-nervioso-autonomo.md
    dopamina-recompensa.md
    cortisol-estres-cronico.md
    neuroplasticidad.md
  /prevencion/
    ideacion-suicida-intervencion.md
    burnout-neurodivergente.md
    crisis-protocolos.md
  /investigacion/
    tesis-tdah-mexico-2022.md
    tesis-autismo-adultos-2021.md
    ... (agregar tesis doctorales aquí)
```

Cada nota debe tener frontmatter YAML:

```yaml
---
titulo: Regulación emocional en TDAH adulto
dominio: neurodivergencias
tags: [tdah, regulacion, emocional, adulto]
fuente: Tesis doctoral - UNAM 2022
confiabilidad: alta
---
```

---

## Pipeline: Obsidian → Vectores → JSON

### Script Python (`build_rag.py`)

```python
# Instalar: pip install chromadb sentence-transformers markdown frontmatter

import os, json, frontmatter
from pathlib import Path
from sentence_transformers import SentenceTransformer
import chromadb

VAULT_PATH = "./vault-neurosincronia"
OUTPUT_JSON = "./docs/rag_index.json"  # se sube a GitHub Pages

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.Client()
collection = client.create_collection("neurosincronia")

chunks = []

for md_file in Path(VAULT_PATH).rglob("*.md"):
    post = frontmatter.load(md_file)
    content = post.content
    meta = post.metadata

    # Chunking: párrafos de ~300 palabras con overlap
    paragraphs = [p.strip() for p in content.split('\n\n') if len(p.strip()) > 50]
    
    for i, chunk in enumerate(paragraphs):
        chunks.append({
            "id": f"{md_file.stem}_{i}",
            "text": chunk,
            "source": meta.get("titulo", md_file.stem),
            "dominio": meta.get("dominio", "general"),
            "tags": meta.get("tags", [])
        })

# Generar embeddings
texts = [c["text"] for c in chunks]
embeddings = model.encode(texts).tolist()

for chunk, emb in zip(chunks, embeddings):
    chunk["embedding"] = emb

# Exportar a JSON estático
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(chunks, f, ensure_ascii=False, indent=2)

print(f"✓ {len(chunks)} chunks indexados → {OUTPUT_JSON}")
```

### Resultado: `rag_index.json` en `/docs/` del repo

Se sirve como archivo estático desde GitHub Pages. El frontend lo carga una vez y hace búsqueda por similitud coseno en el cliente.

---

## Búsqueda en el frontend (JavaScript)

```javascript
// Carga el índice una sola vez
let RAG_INDEX = null;

async function loadRAG() {
  const res = await fetch('/neurosincronia/rag_index.json');
  RAG_INDEX = await res.json();
}

// Similitud coseno
function cosineSim(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, x) => s + x*x, 0));
  const magB = Math.sqrt(b.reduce((s, x) => s + x*x, 0));
  return dot / (magA * magB);
}

// Buscar los top-K chunks relevantes
async function retrieveContext(query, topK = 3) {
  if (!RAG_INDEX) await loadRAG();
  
  // Necesita embedding del query — opciones:
  // A) Llamar a Anthropic Embeddings API
  // B) Usar modelo ONNX en el browser (transformers.js)
  const queryEmbedding = await embedQuery(query);
  
  const scored = RAG_INDEX.map(chunk => ({
    ...chunk,
    score: cosineSim(queryEmbedding, chunk.embedding)
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(c => `[${c.source}]\n${c.text}`)
    .join('\n\n---\n\n');
}

// Inyectar en el system prompt
async function buildSystemWithRAG(userQuery, baseSystemPrompt) {
  const context = await retrieveContext(userQuery);
  return baseSystemPrompt + `

[BASE DE CONOCIMIENTO — FUENTES RELEVANTES]
${context}

Usa estas fuentes para fundamentar tu respuesta cuando sean pertinentes. Cita la fuente brevemente si la usas.`;
}
```

---

## Embedding del query en el browser

### Opción más simple: `transformers.js` (Xenova)

```html
<script type="module">
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

window.embedQuery = async function(text) {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};
</script>
```

Funciona 100% en el browser, sin API adicional. El modelo (~25MB) se cachea en el cliente.

---

## Tamaño estimado del índice

| Notas | Chunks promedio | JSON resultante |
|---|---|---|
| 20 notas | ~200 chunks | ~8 MB |
| 50 notas | ~500 chunks | ~20 MB |
| 100 notas | ~1000 chunks | ~40 MB |

Con 20-50 notas bien redactadas es suficiente para la fase inicial. Paginación o fragmentación si crece mucho.

---

## Roadmap Fase 2

- [ ] Crear estructura de vault en Obsidian
- [ ] Redactar / importar las primeras 10 notas clave (TDAH, burnout, funciones ejecutivas, crisis)
- [ ] Correr `build_rag.py` y verificar chunks
- [ ] Subir `rag_index.json` a `/docs/` del repo
- [ ] Integrar `retrieveContext()` en `agente.html`
- [ ] Probar con 5 queries reales y ajustar chunk size
- [ ] Agregar tesis doctorales como notas largas
- [ ] Fase 2.5: interfaz para ver las fuentes usadas en cada respuesta

---

## Nota sobre privacidad

El vault de Obsidian **nunca** se sube completo al repo. Solo el JSON de embeddings (vectores + texto de los chunks). Los documentos originales permanecen locales. Si alguna nota es confidencial o tiene restricciones de copyright, se excluye del pipeline con un flag en el frontmatter:

```yaml
---
exportar_rag: false
---
```

---

*Documento vivo — actualizar con cada iteración*
