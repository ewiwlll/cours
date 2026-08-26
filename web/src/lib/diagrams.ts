import type { ImageOcclusionDiagram } from './types';

export const BIO_DIAGRAMS: ImageOcclusionDiagram[] = [
  {
    id: 'eukaryotic-cell',
    title: 'Cellule Eucaryote Animale',
    category: 'Biologie Cellulaire',
    description: 'Organisation ultrastructurale des organites cellulaires et de la membrane plasmique.',
    viewBox: '0 0 800 600',
    svgContent: `
      <!-- Background / Cytosol -->
      <defs>
        <radialGradient id="cytoGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9"/>
        </radialGradient>
        <radialGradient id="nucGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#4338ca" stop-opacity="0.6"/>
        </radialGradient>
        <linearGradient id="mitoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f97316"/>
          <stop offset="100%" stop-color="#c2410c"/>
        </linearGradient>
      </defs>

      <!-- Cell Membrane & Cytoplasm -->
      <path d="M 120 300 C 100 150, 250 80, 420 90 C 600 100, 720 180, 730 320 C 740 460, 620 540, 440 530 C 240 520, 140 450, 120 300 Z" fill="url(#cytoGrad)" stroke="#38bdf8" stroke-width="4" filter="drop-shadow(0 0 10px rgba(56,189,248,0.2))"/>
      <path d="M 130 300 C 110 160, 255 95, 415 105 C 585 115, 705 190, 715 320 C 725 450, 610 525, 435 515 C 250 505, 150 440, 130 300 Z" fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6"/>

      <!-- Centrosome / Centrioles -->
      <g transform="translate(230, 200)">
        <rect x="-8" y="-18" width="16" height="36" rx="4" fill="#a855f7" transform="rotate(45)" opacity="0.9"/>
        <rect x="-8" y="-18" width="16" height="36" rx="4" fill="#c084fc" transform="rotate(-45)" opacity="0.9"/>
        <circle cx="0" cy="0" r="28" fill="none" stroke="#a855f7" stroke-width="1" stroke-dasharray="2,2" opacity="0.4"/>
      </g>

      <!-- Mitochondria 1 -->
      <g transform="translate(560, 200) rotate(-25)">
        <ellipse cx="0" cy="0" rx="60" ry="32" fill="url(#mitoGrad)" stroke="#ea580c" stroke-width="2"/>
        <!-- Cristae -->
        <path d="M -45 0 Q -35 -18 -20 0 Q -5 18 10 0 Q 25 -18 40 0" fill="none" stroke="#ffedd5" stroke-width="3" stroke-linecap="round"/>
        <path d="M -35 -12 Q -20 5 -5 -12" fill="none" stroke="#ffedd5" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 0 12 Q 15 -5 30 12" fill="none" stroke="#ffedd5" stroke-width="2.5" stroke-linecap="round"/>
      </g>

      <!-- Mitochondria 2 (smaller) -->
      <g transform="translate(250, 420) rotate(35)">
        <ellipse cx="0" cy="0" rx="48" ry="24" fill="url(#mitoGrad)" stroke="#ea580c" stroke-width="2"/>
        <path d="M -32 0 Q -20 -12 -8 0 Q 5 12 20 0 Q 30 -10 32 0" fill="none" stroke="#ffedd5" stroke-width="2.5" stroke-linecap="round"/>
      </g>

      <!-- Rough Endoplasmic Reticulum (RER) around nucleus -->
      <g stroke="#ec4899" stroke-width="3.5" fill="none" stroke-linecap="round">
        <path d="M 280 250 C 260 270, 250 330, 270 370 C 280 390, 300 410, 320 420"/>
        <path d="M 260 240 C 235 270, 230 340, 250 390 C 265 420, 290 440, 320 450"/>
        <path d="M 240 245 C 215 285, 210 360, 235 410"/>
      </g>
      <!-- Ribosomes on RER (Dots) -->
      <g fill="#f43f5e">
        <circle cx="270" cy="260" r="3"/><circle cx="255" cy="290" r="3"/><circle cx="250" cy="330" r="3"/>
        <circle cx="260" cy="370" r="3"/><circle cx="280" cy="400" r="3"/><circle cx="235" cy="270" r="3"/>
        <circle cx="225" cy="310" r="3"/><circle cx="230" cy="360" r="3"/><circle cx="245" cy="400" r="3"/>
      </g>

      <!-- Smooth Endoplasmic Reticulum (REL) -->
      <g stroke="#8b5cf6" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M 490 410 C 520 430, 560 410, 580 430 C 600 450, 580 480, 550 475 C 520 470, 510 440, 480 430"/>
        <path d="M 520 440 C 545 455, 570 440, 585 460"/>
      </g>

      <!-- Nucleus -->
      <g transform="translate(390, 320)">
        <circle cx="0" cy="0" r="85" fill="url(#nucGrad)" stroke="#818cf8" stroke-width="4" stroke-dasharray="16,4"/>
        <!-- Nucleolus -->
        <circle cx="-15" cy="-10" r="28" fill="#4f46e5" stroke="#a5b4fc" stroke-width="2"/>
        <circle cx="-15" cy="-10" r="18" fill="#3730a3"/>
        <!-- Chromatin threads -->
        <path d="M -50 20 Q -20 40 10 25 Q 40 10 50 35" fill="none" stroke="#c7d2fe" stroke-width="2" opacity="0.6"/>
        <path d="M 10 -45 Q 35 -30 45 -5 Q 55 20 30 50" fill="none" stroke="#c7d2fe" stroke-width="2" opacity="0.6"/>
      </g>

      <!-- Golgi Apparatus -->
      <g transform="translate(560, 340) rotate(15)">
        <path d="M -50 -30 C -20 -40, 20 -40, 50 -30" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>
        <path d="M -55 -10 C -20 -20, 20 -20, 55 -10" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>
        <path d="M -50 10 C -20 0, 20 0, 50 10" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>
        <path d="M -40 30 C -15 20, 15 20, 40 30" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>
        <!-- Secretory Vesicles -->
        <circle cx="65" cy="-25" r="7" fill="#34d399"/>
        <circle cx="70" cy="5" r="9" fill="#34d399"/>
        <circle cx="55" cy="35" r="6" fill="#34d399"/>
        <circle cx="-65" cy="-5" r="6" fill="#059669"/>
      </g>

      <!-- Lysosomes / Peroxisomes -->
      <g transform="translate(200, 330)">
        <circle cx="0" cy="0" r="18" fill="#eab308" stroke="#ca8a04" stroke-width="2.5"/>
        <circle cx="-4" cy="-4" r="4" fill="#fef08a"/>
        <circle cx="4" cy="5" r="3" fill="#a16207"/>
      </g>
      <g transform="translate(470, 160)">
        <circle cx="0" cy="0" r="14" fill="#14b8a6" stroke="#0d9488" stroke-width="2"/>
        <circle cx="-3" cy="-3" r="3" fill="#99f6e4"/>
      </g>

      <!-- Free Ribosomes -->
      <g fill="#38bdf8" opacity="0.8">
        <circle cx="340" cy="180" r="2.5"/><circle cx="350" cy="185" r="2.5"/><circle cx="335" cy="195" r="2.5"/>
        <circle cx="480" cy="270" r="2.5"/><circle cx="490" cy="265" r="2.5"/>
        <circle cx="390" cy="460" r="2.5"/><circle cx="405" cy="470" r="2.5"/>
      </g>

      <!-- Pointers and Label Anchors -->
      <text x="390" y="325" fill="#ffffff" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Noyau</text>
      <text x="375" y="305" fill="#e0e7ff" font-size="11" font-family="sans-serif" text-anchor="middle">Nucléole</text>
      <text x="560" y="205" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Mitochondrie</text>
      <text x="560" y="345" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Appareil de Golgi</text>
      <text x="235" y="325" fill="#ffffff" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">Réticulum (RER)</text>
      <text x="200" y="335" fill="#ffffff" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">Lysosome</text>
      <text x="230" y="205" fill="#ffffff" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">Centrosome</text>
      <text x="550" y="445" fill="#ffffff" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">Réticulum lisse (REL)</text>
      <text x="430" y="70" fill="#38bdf8" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Membrane Plasmique</text>
    `,
    masks: [
      { id: 'm1', x: 42, y: 46, width: 16, height: 8, solution: 'Noyau (Nucléoplasme + Nucléole)', hint: 'Contient l\'information génétique sous forme d\'ADN', color: '#6366f1' },
      { id: 'm2', x: 63, y: 28, width: 18, height: 8, solution: 'Mitochondrie', hint: 'Centrale énergétique, siège de la phosphorylation oxydative', color: '#f97316' },
      { id: 'm3', x: 62, y: 52, width: 20, height: 8, solution: 'Appareil de Golgi', hint: 'Maturation, tri et emballage vésiculaire des protéines', color: '#10b981' },
      { id: 'm4', x: 23, y: 49, width: 20, height: 8, solution: 'Réticulum Endoplasmique Rugueux (RER)', hint: 'Réseau parsemé de ribosomes pour la synthèse protéique', color: '#ec4899' },
      { id: 'm5', x: 21, y: 57, width: 14, height: 7, solution: 'Lysosome', hint: 'Organite de digestion cellulaire à pH acide', color: '#eab308' },
      { id: 'm6', x: 62, y: 69, width: 22, height: 8, solution: 'Réticulum Endoplasmique Lisse (REL)', hint: 'Synthèse des lipides et détoxification cellulaire', color: '#8b5cf6' },
      { id: 'm7', x: 23, y: 28, width: 15, height: 7, solution: 'Centrosome / Centrioles', hint: 'Centre organisateur des microtubules cellulaires', color: '#c084fc' },
      { id: 'm8', x: 45, y: 8, width: 26, height: 7, solution: 'Membrane Plasmique', hint: 'Bicouche lipidique délimitant la cellule', color: '#38bdf8' },
    ],
  },
  {
    id: 'amino-acid',
    title: 'Structure Générale d\'un Acide Aminé',
    category: 'Biochimie Structurale',
    description: 'Structure canonique des acides alpha-aminés avec leurs quatre substituants tétraédriques.',
    viewBox: '0 0 800 500',
    svgContent: `
      <!-- Center Carbon Alpha -->
      <circle cx="400" cy="250" r="42" fill="#1e293b" stroke="#38bdf8" stroke-width="4" filter="drop-shadow(0 0 12px rgba(56,189,248,0.3))"/>
      <text x="400" y="258" fill="#38bdf8" font-size="28" font-family="sans-serif" font-weight="900" text-anchor="middle">Cα</text>

      <!-- Bonds -->
      <!-- Left bond to NH2 -->
      <line x1="358" y1="250" x2="230" y2="250" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <!-- Right bond to COOH -->
      <line x1="442" y1="250" x2="570" y2="250" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <!-- Top bond to H -->
      <line x1="400" y1="208" x2="400" y2="105" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <!-- Bottom bond to R (Wedge/hashed bond style) -->
      <polygon points="392,292 408,292 422,390 378,390" fill="#a855f7" opacity="0.85"/>

      <!-- Group 1: Amine group (Left) -->
      <g transform="translate(170, 250)">
        <rect x="-70" y="-45" width="140" height="90" rx="16" fill="#1e1b4b" stroke="#6366f1" stroke-width="3"/>
        <text x="0" y="8" fill="#a5b4fc" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">H₂N —</text>
        <text x="0" y="32" fill="#818cf8" font-size="13" font-family="sans-serif" text-anchor="middle">Groupement Amine</text>
      </g>

      <!-- Group 2: Carboxylic acid (Right) -->
      <g transform="translate(630, 250)">
        <rect x="-75" y="-45" width="150" height="90" rx="16" fill="#450a0a" stroke="#ef4444" stroke-width="3"/>
        <text x="0" y="8" fill="#fca5a5" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">— COOH</text>
        <text x="0" y="32" fill="#f87171" font-size="13" font-family="sans-serif" text-anchor="middle">Groupement Carboxyle</text>
      </g>

      <!-- Group 3: Hydrogen atom (Top) -->
      <g transform="translate(400, 75)">
        <circle cx="0" cy="0" r="38" fill="#064e3b" stroke="#10b981" stroke-width="3"/>
        <text x="0" y="8" fill="#6ee7b7" font-size="24" font-family="sans-serif" font-weight="bold" text-anchor="middle">H</text>
        <text x="0" y="24" fill="#34d399" font-size="10" font-family="sans-serif" text-anchor="middle">Hydrogène</text>
      </g>

      <!-- Group 4: Radical R side chain (Bottom) -->
      <g transform="translate(400, 420)">
        <rect x="-85" y="-35" width="170" height="70" rx="16" fill="#3b0764" stroke="#c084fc" stroke-width="3"/>
        <text x="0" y="5" fill="#e9d5ff" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">R</text>
        <text x="0" y="25" fill="#d8b4fe" font-size="12" font-family="sans-serif" text-anchor="middle">Chaîne latérale variable</text>
      </g>
    `,
    masks: [
      { id: 'aa1', x: 44, y: 44, width: 12, height: 12, solution: 'Carbone Alpha (Cα)', hint: 'Carbone central asymétrique (sauf pour la glycine)', color: '#38bdf8' },
      { id: 'aa2', x: 12, y: 41, width: 18, height: 18, solution: 'Groupement Amine (-NH₂)', hint: 'Groupement basique protonable en -NH3+', color: '#6366f1' },
      { id: 'aa3', x: 69, y: 41, width: 20, height: 18, solution: 'Groupement Carboxyle (-COOH)', hint: 'Groupement acide déprotonable en -COO-', color: '#ef4444' },
      { id: 'aa4', x: 44, y: 7, width: 12, height: 16, solution: 'Atome d\'Hydrogène (-H)', hint: 'Substituant minimaliste présent sur tous les 20 AA standards', color: '#10b981' },
      { id: 'aa5', x: 39, y: 76, width: 22, height: 16, solution: 'Chaîne latérale variable (R)', hint: 'Détermine les propriétés physico-chimiques propres de chaque acide aminé', color: '#c084fc' },
    ],
  },
  {
    id: 'krebs-cycle',
    title: 'Cycle de Krebs (Acide Citrique)',
    category: 'Biochimie Métabolique',
    description: 'Voie métabolique centrale de dégradation de l\'Acétyl-CoA dans la matrice mitochondriale.',
    viewBox: '0 0 900 700',
    svgContent: `
      <!-- Main circular track -->
      <circle cx="450" cy="380" r="230" fill="none" stroke="#334155" stroke-width="4" stroke-dasharray="10,6"/>
      <circle cx="450" cy="380" r="230" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.3"/>

      <!-- Center Title -->
      <text x="450" y="370" fill="#f8fafc" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle">CYCLE DE KREBS</text>
      <text x="450" y="395" fill="#94a3b8" font-size="14" font-family="sans-serif" text-anchor="middle">Matrice Mitochondriale</text>
      <text x="450" y="420" fill="#f59e0b" font-size="12" font-family="sans-serif" text-anchor="middle">Bilan : 3 NADH + 1 FADH₂ + 1 GTP</text>

      <!-- Entry: Acetyl-CoA (Top Left) -->
      <g transform="translate(250, 100)">
        <rect x="-70" y="-22" width="140" height="44" rx="10" fill="#1e1b4b" stroke="#818cf8" stroke-width="2"/>
        <text x="0" y="5" fill="#c7d2fe" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Acétyl-CoA (2C)</text>
      </g>
      <path d="M 320 100 Q 420 100 450 145" fill="none" stroke="#818cf8" stroke-width="3" marker-end="url(#arrow)"/>

      <!-- 1. Citrate (Top 12 o'clock) -->
      <g transform="translate(450, 150)">
        <rect x="-65" y="-24" width="130" height="48" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="0" y="5" fill="#38bdf8" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle">Citrate (6C)</text>
      </g>

      <!-- 2. Isocitrate (2 o'clock) -->
      <g transform="translate(640, 240)">
        <rect x="-65" y="-24" width="130" height="48" rx="12" fill="#0f172a" stroke="#22c55e" stroke-width="2.5"/>
        <text x="0" y="5" fill="#4ade80" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle">Isocitrate (6C)</text>
      </g>

      <!-- 3. alpha-Cetoglutarate (4 o'clock) -->
      <g transform="translate(670, 440)">
        <rect x="-85" y="-24" width="170" height="48" rx="12" fill="#0f172a" stroke="#eab308" stroke-width="2.5"/>
        <text x="0" y="5" fill="#fde047" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">α-Cétoglutarate (5C)</text>
      </g>

      <!-- 4. Succinyl-CoA (5:30 o'clock) -->
      <g transform="translate(560, 590)">
        <rect x="-75" y="-24" width="150" height="48" rx="12" fill="#0f172a" stroke="#ec4899" stroke-width="2.5"/>
        <text x="0" y="5" fill="#f472b6" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Succinyl-CoA (4C)</text>
      </g>

      <!-- 5. Succinate (7 o'clock) -->
      <g transform="translate(340, 590)">
        <rect x="-65" y="-24" width="130" height="48" rx="12" fill="#0f172a" stroke="#a855f7" stroke-width="2.5"/>
        <text x="0" y="5" fill="#c084fc" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle">Succinate (4C)</text>
      </g>

      <!-- 6. Fumarate (8:30 o'clock) -->
      <g transform="translate(230, 450)">
        <rect x="-65" y="-24" width="130" height="48" rx="12" fill="#0f172a" stroke="#06b6d4" stroke-width="2.5"/>
        <text x="0" y="5" fill="#22d3ee" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle">Fumarate (4C)</text>
      </g>

      <!-- 7. Malate (10 o'clock) -->
      <g transform="translate(240, 260)">
        <rect x="-60" y="-24" width="120" height="48" rx="12" fill="#0f172a" stroke="#10b981" stroke-width="2.5"/>
        <text x="0" y="5" fill="#34d399" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle">Malate (4C)</text>
      </g>

      <!-- 8. Oxaloacetate (11 o'clock) -->
      <g transform="translate(350, 160)">
        <rect x="-70" y="-24" width="140" height="48" rx="12" fill="#0f172a" stroke="#f43f5e" stroke-width="2.5"/>
        <text x="0" y="5" fill="#fb7185" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Oxaloacétate (4C)</text>
      </g>

      <!-- Byproducts / Energy Outputs -->
      <text x="730" y="340" fill="#fbbf24" font-size="12" font-family="sans-serif" font-weight="bold">→ NADH + CO₂</text>
      <text x="730" y="530" fill="#fbbf24" font-size="12" font-family="sans-serif" font-weight="bold">→ NADH + CO₂</text>
      <text x="450" y="660" fill="#fbbf24" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">→ GTP (ATP)</text>
      <text x="140" y="530" fill="#fbbf24" font-size="12" font-family="sans-serif" font-weight="bold">→ FADH₂</text>
      <text x="160" y="360" fill="#fbbf24" font-size="12" font-family="sans-serif" font-weight="bold">→ NADH</text>
    `,
    masks: [
      { id: 'kr1', x: 20, y: 11, width: 16, height: 7, solution: 'Acétyl-CoA', hint: 'Composé à 2 carbones issu de la glycolyse ou bêta-oxydation', color: '#818cf8' },
      { id: 'kr2', x: 31, y: 19, width: 16, height: 8, solution: 'Oxaloacétate', hint: 'Composé accepteur à 4 carbones régénéré en fin de cycle', color: '#f43f5e' },
      { id: 'kr3', x: 43, y: 18, width: 15, height: 8, solution: 'Citrate', hint: 'Premier intermédiaire à 6 carbones formé par condensation', color: '#38bdf8' },
      { id: 'kr4', x: 64, y: 30, width: 15, height: 8, solution: 'Isocitrate', hint: 'Intermédiaire isomère issu de l\'action de l\'aconitase', color: '#22c55e' },
      { id: 'kr5', x: 65, y: 59, width: 20, height: 8, solution: 'α-Cétoglutarate', hint: 'Composé à 5 carbones issu de la 1ère décarboxylation oxydative', color: '#eab308' },
      { id: 'kr6', x: 54, y: 80, width: 18, height: 8, solution: 'Succinyl-CoA', hint: 'Composé à haute énergie lié à la Coenzyme A', color: '#ec4899' },
      { id: 'kr7', x: 31, y: 80, width: 16, height: 8, solution: 'Succinate', hint: 'Substrat de la succinate déshydrogénase (Complexe II)', color: '#a855f7' },
      { id: 'kr8', x: 19, y: 60, width: 15, height: 8, solution: 'Fumarate', hint: 'Produit de l\'oxydation du succinate produisant du FADH2', color: '#06b6d4' },
      { id: 'kr9', x: 20, y: 33, width: 14, height: 8, solution: 'Malate', hint: 'Hydratation du fumarate avant déshydrogénation finale', color: '#10b981' },
    ],
  },
  {
    id: 'dna-double-helix',
    title: 'Structure de la Double Hélice d\'ADN',
    category: 'Génétique & Biologie Moléculaire',
    description: 'Modèle de Watson et Crick : appariement des bases puriques et pyrimidiques, sillons et squelette sucre-phosphate.',
    viewBox: '0 0 800 650',
    svgContent: `
      <!-- Backbones -->
      <path d="M 280 60 C 400 150, 400 250, 280 340 C 160 430, 160 530, 280 620" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" filter="drop-shadow(0 0 8px rgba(56,189,248,0.4))"/>
      <path d="M 520 60 C 400 150, 400 250, 520 340 C 640 430, 640 530, 520 620" fill="none" stroke="#f43f5e" stroke-width="12" stroke-linecap="round" filter="drop-shadow(0 0 8px rgba(244,63,94,0.4))"/>

      <!-- Base Pairs Rungs (Horizontal Connectors) -->
      <!-- Rung 1: Adenine - Thymine -->
      <g transform="translate(400, 100)">
        <rect x="-100" y="-12" width="95" height="24" rx="6" fill="#3b82f6"/>
        <text x="-52" y="5" fill="#ffffff" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Adénine (A)</text>
        <line x1="-5" y1="-4" x2="5" y2="-4" stroke="#fef08a" stroke-width="3" stroke-dasharray="3,2"/>
        <line x1="-5" y1="4" x2="5" y2="4" stroke="#fef08a" stroke-width="3" stroke-dasharray="3,2"/>
        <rect x="5" y="-12" width="95" height="24" rx="6" fill="#ef4444"/>
        <text x="52" y="5" fill="#ffffff" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Thymine (T)</text>
      </g>

      <!-- Rung 2: Guanine - Cytosine -->
      <g transform="translate(400, 170)">
        <rect x="-70" y="-12" width="65" height="24" rx="6" fill="#10b981"/>
        <text x="-37" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Guanine (G)</text>
        <line x1="-5" y1="-6" x2="5" y2="-6" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <line x1="-5" y1="0" x2="5" y2="0" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <line x1="-5" y1="6" x2="5" y2="6" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <rect x="5" y="-12" width="65" height="24" rx="6" fill="#f59e0b"/>
        <text x="37" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Cytosine (C)</text>
      </g>

      <!-- Rung 3: Crossing Point (C-G) -->
      <g transform="translate(400, 245)">
        <rect x="-35" y="-10" width="30" height="20" rx="4" fill="#f59e0b"/>
        <rect x="5" y="-10" width="30" height="20" rx="4" fill="#10b981"/>
      </g>

      <!-- Rung 4: Thymine - Adenine -->
      <g transform="translate(400, 320)">
        <rect x="-70" y="-12" width="65" height="24" rx="6" fill="#ef4444"/>
        <text x="-37" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Thymine (T)</text>
        <line x1="-5" y1="-4" x2="5" y2="-4" stroke="#fef08a" stroke-width="3" stroke-dasharray="3,2"/>
        <line x1="-5" y1="4" x2="5" y2="4" stroke="#fef08a" stroke-width="3" stroke-dasharray="3,2"/>
        <rect x="5" y="-12" width="65" height="24" rx="6" fill="#3b82f6"/>
        <text x="37" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Adénine (A)</text>
      </g>

      <!-- Rung 5: Cytosine - Guanine -->
      <g transform="translate(400, 400)">
        <rect x="-105" y="-12" width="100" height="24" rx="6" fill="#f59e0b"/>
        <text x="-55" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Cytosine (C)</text>
        <line x1="-5" y1="-6" x2="5" y2="-6" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <line x1="-5" y1="0" x2="5" y2="0" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <line x1="-5" y1="6" x2="5" y2="6" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="2,2"/>
        <rect x="5" y="-12" width="100" height="24" rx="6" fill="#10b981"/>
        <text x="55" y="5" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">Guanine (G)</text>
      </g>

      <!-- Structural labels & Grooves -->
      <!-- Major Groove (Grand Sillon) -->
      <path d="M 640 180 C 670 210, 670 270, 640 300" fill="none" stroke="#a855f7" stroke-width="3"/>
      <text x="730" y="245" fill="#c084fc" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Grand Sillon (22 Å)</text>

      <!-- Minor Groove (Petit Sillon) -->
      <path d="M 160 370 C 130 395, 130 435, 160 460" fill="none" stroke="#ec4899" stroke-width="3"/>
      <text x="80" y="420" fill="#f472b6" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">Petit Sillon (12 Å)</text>

      <!-- Polarity 5' and 3' -->
      <text x="280" y="40" fill="#38bdf8" font-size="18" font-family="sans-serif" font-weight="900" text-anchor="middle">5'</text>
      <text x="520" y="40" fill="#f43f5e" font-size="18" font-family="sans-serif" font-weight="900" text-anchor="middle">3'</text>
      <text x="280" y="645" fill="#38bdf8" font-size="18" font-family="sans-serif" font-weight="900" text-anchor="middle">3'</text>
      <text x="520" y="645" fill="#f43f5e" font-size="18" font-family="sans-serif" font-weight="900" text-anchor="middle">5'</text>
    `,
    masks: [
      { id: 'dna1', x: 26, y: 13, width: 14, height: 6, solution: 'Adénine (A)', hint: 'Base purique s\'appariant avec la Thymine par 2 liaisons hydrogène', color: '#3b82f6' },
      { id: 'dna2', x: 50, y: 13, width: 14, height: 6, solution: 'Thymine (T)', hint: 'Base pyrimidique spécifique de l\'ADN (remplacée par l\'Uracile dans l\'ARN)', color: '#ef4444' },
      { id: 'dna3', x: 30, y: 24, width: 12, height: 6, solution: 'Guanine (G)', hint: 'Base purique s\'appariant avec la Cytosine par 3 liaisons hydrogène', color: '#10b981' },
      { id: 'dna4', x: 50, y: 24, width: 12, height: 6, solution: 'Cytosine (C)', hint: 'Base pyrimidique complémentaire de la Guanine', color: '#f59e0b' },
      { id: 'dna5', x: 70, y: 35, width: 26, height: 6, solution: 'Grand Sillon (Major Groove)', hint: 'Région accessible où les protéines régulatrices / facteurs de transcription se lient', color: '#a855f7' },
      { id: 'dna6', x: 3, y: 62, width: 25, height: 6, solution: 'Petit Sillon (Minor Groove)', hint: 'Sillon plus étroit entre les deux brins de la double hélice', color: '#ec4899' },
      { id: 'dna7', x: 31, y: 3, width: 8, height: 6, solution: 'Extrémité 5\' Phosphate', hint: 'Extrémité portant le groupement phosphate libre sur le C5\' du désoxyribose', color: '#38bdf8' },
      { id: 'dna8', x: 61, y: 3, width: 8, height: 6, solution: 'Extrémité 3\' Hydroxyle', hint: 'Extrémité portant le groupement -OH libre sur le C3\' du désoxyribose', color: '#f43f5e' },
    ],
  },
];
