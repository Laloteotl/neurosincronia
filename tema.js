// ═══════════════════════════════════════
// NEUROSINCRONIA — Sistema de temas global
// Incluir en todos los módulos:
// <script src="tema.js"></script>
// ═══════════════════════════════════════

const NS_TEMAS = {
  'verde': {
    '--bg':           '#000000',
    '--surface':      '#0a0a0a',
    '--border':       '#00aa2a',
    '--border-dim':   'rgba(0,255,65,0.15)',
    '--text':         '#00ff41',
    '--text-dim':     '#00aa2a',
    '--text-bright':  '#ffffff',
    '--accent':       '#00ff41',
    '--accent-dim':   'rgba(0,255,65,0.08)',
    '--danger':       '#ff2d55',
    '--warning':      '#ffaa00',
    '--btn-bg':       '#00ff41',
    '--btn-text':     '#000000',
    '--scanlines':    '1',
  },
  'azul': {
    '--bg':           '#0d0f11',
    '--surface':      '#13161a',
    '--border':       '#1e2327',
    '--border-dim':   '#2e3540',
    '--text':         '#c8cdd4',
    '--text-dim':     '#5a6270',
    '--text-bright':  '#e8ecf0',
    '--accent':       '#4a9eff',
    '--accent-dim':   '#1a3a5c',
    '--danger':       '#e05555',
    '--warning':      '#f0a050',
    '--btn-bg':       '#4a9eff',
    '--btn-text':     '#ffffff',
    '--scanlines':    '0',
  },
  'claro': {
    '--bg':           '#f5f4f0',
    '--surface':      '#ffffff',
    '--border':       '#ddd9d0',
    '--border-dim':   '#c5bfb5',
    '--text':         '#3a3630',
    '--text-dim':     '#9a9088',
    '--text-bright':  '#1a1612',
    '--accent':       '#5b7fa6',
    '--accent-dim':   '#dce8f5',
    '--danger':       '#b84040',
    '--warning':      '#b87830',
    '--btn-bg':       '#5b7fa6',
    '--btn-text':     '#ffffff',
    '--scanlines':    '0',
  }
};

function nsAplicarTema(nombre) {
  const tema = NS_TEMAS[nombre];
  if (!tema) return;
  const root = document.documentElement;
  Object.entries(tema).forEach(([k, v]) => root.style.setProperty(k, v));

  // Scanlines solo en tema verde
  const overlay = document.getElementById('ns-scanlines');
  if (overlay) overlay.style.display = tema['--scanlines'] === '1' ? 'block' : 'none';

  // Guardar selección
  localStorage.setItem('ns_tema', nombre);

  // Marcar botón activo si existe el selector
  document.querySelectorAll('.ns-tema-btn').forEach(b => {
    b.classList.toggle('ns-activo', b.dataset.tema === nombre);
  });
}

function nsIniciar() {
  const guardado = localStorage.getItem('ns_tema') || 'verde';
  nsAplicarTema(guardado);
}

// Ejecutar al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', nsIniciar);
} else {
  nsIniciar();
}
