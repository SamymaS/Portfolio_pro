/* ================================================================
   i18n.js — FR / EN translations + auto-detect + toggle
   ================================================================ */
const TRANSLATIONS = {
  fr: {
    // nav
    nav_home:'Accueil', nav_about:'Profil', nav_skills:'Skills',
    nav_xp:'Expériences', nav_projects:'Projets', nav_certs:'Formations',
    nav_games:'Jeux', nav_contact:'Contact', nav_available:'Disponible',
    // hero
    hero_tag:'Ingénieur Logiciel · Fullstack & IoT · 24 ans',
    hero_sub:'Backend robuste · Frontend interactif · Systèmes embarqués',
    hero_cta1:'Voir mes projets', hero_cta2:'Me contacter',
    // stats
    stat1_label:"Ans d'expérience", stat2_label:'Projets réalisés',
    stat3_label:'Langages maîtrisés', stat4_label:'Score TOEIC',
    // about
    about_num:'01', about_title:'Profil',
    about_lead:'Ingénieur logiciel passionné, je couvre l\'<strong>ensemble du cycle de développement</strong> — du backend robuste aux systèmes embarqués en passant par le frontend interactif.',
    about_p1:'Actuellement en alternance chez <strong>CS GROUP</strong> sur la plateforme MobilitX, je travaille sur des architectures modulaires Java/Kotlin à forte contrainte de performance.',
    about_p2:'Curieux, autonome, et orienté qualité — j\'aime construire des choses qui durent et qui ont du sens.',
    meta_formation_label:'Formation', meta_formation_val:'Mastère Expert Dev Logiciel & IoT – Ynov Aix 2024–2026',
    meta_rythme_label:'Rythme', meta_rythme_val:'3 semaines entreprise / 1 semaine école',
    meta_loc_label:'Localisation', meta_loc_val:'Aix-en-Provence, France',
    meta_lang_label:'Langues', meta_lang_val:'Français · Anglais C2 (TOEIC 900+) · Espagnol',
    // skills
    skills_num:'02', skills_title:'Compétences',
    // xp
    xp_num:'03', xp_title:'Expériences',
    xp1_title:'Ingénieur Logiciel – Alternance',
    xp1_desc:'Développement backend Java / Kotlin sur la plateforme <strong>MobilitX</strong> (transport & données temps réel). Architecture modulaire et événementielle.',
    xp2_title:'Développeur Fullstack Salesforce – Alternance',
    xp2_desc:'Analyse des besoins clients, développement et paramétrage d\'applications Salesforce. Bonnes pratiques CI/CD.',
    xp3_title:'Développeur Logiciel Fullstack – Alternance',
    xp3_desc:'Refonte du logiciel de facturation LUCY. Frontend C++/Qt, backend Python Flask. PL/SQL & imports CSV/XLSX.',
    xp4_title:'Technicien Informatique – Stage',
    xp4_desc:'Digitalisation ERP, modules e-learning Java/SharePoint, support technique et déploiement de postes.',
    // projects
    proj_num:'04', proj_title:'Projets',
    filter_all:'Tous', filter_mobile:'Mobile', filter_iot:'IoT',
    filter_web:'Web & API', filter_rt:'Temps Réel',
    wip:'En cours',
    // certs
    cert_num:'05', cert_title:'Formations & Certifications',
    // games
    games_num:'06', games_title:'Mini-Jeux',
    games_intro:'Un peu de fun ? Joue directement dans le navigateur.',
    // contact
    contact_num:'07', contact_title:'Contact',
    contact_lead:'Vous avez un projet, une opportunité ou envie d\'échanger ? Je suis disponible.',
    form_name:'Votre nom', form_email:'Votre email', form_msg:'Votre message...',
    form_send:'Envoyer le message',
    form_sending:'Envoi en cours…',
    form_sent:'✓ Message envoyé !',
    form_err_name:'Le nom est requis',
    form_err_email:'Email invalide',
    form_err_msg:'Le message est requis',
    form_err_send:'Erreur d\'envoi, réessayez.',
    // footer
    footer_hint:"Tapez 'sb' pour un easter egg 🥚",
    // scroll-to-top title
    stt_title:'Retour en haut',
    // easter egg
    ee_welcome:'Bienvenue dans le terminal de Samy ! 👾',
    ee_hint:"Tape 'help' pour les commandes.",
    // cv
    cv_download:'Télécharger mon CV',
  },
  en: {
    nav_home:'Home', nav_about:'About', nav_skills:'Skills',
    nav_xp:'Experience', nav_projects:'Projects', nav_certs:'Education',
    nav_games:'Games', nav_contact:'Contact', nav_available:'Available',
    hero_tag:'Software Engineer · Fullstack & IoT · 24 y/o',
    hero_sub:'Solid backend · Interactive frontend · Embedded systems',
    hero_cta1:'See my projects', hero_cta2:'Contact me',
    stat1_label:'Years of experience', stat2_label:'Projects built',
    stat3_label:'Languages mastered', stat4_label:'TOEIC score',
    about_num:'01', about_title:'About',
    about_lead:'Passionate software engineer, I cover the <strong>full development cycle</strong> — from robust backend to embedded systems and interactive frontend.',
    about_p1:'Currently in apprenticeship at <strong>CS GROUP</strong> on the MobilitX platform, working on modular Java/Kotlin architectures under strict performance constraints.',
    about_p2:'Curious, autonomous, and quality-driven — I love building things that last and make sense.',
    meta_formation_label:'Education', meta_formation_val:'M.Sc Expert Software Dev & IoT – Ynov Aix 2024–2026',
    meta_rythme_label:'Schedule', meta_rythme_val:'3 weeks company / 1 week school',
    meta_loc_label:'Location', meta_loc_val:'Aix-en-Provence, France',
    meta_lang_label:'Languages', meta_lang_val:'French · English C2 (TOEIC 900+) · Spanish',
    skills_num:'02', skills_title:'Skills',
    xp_num:'03', xp_title:'Experience',
    xp1_title:'Software Engineer – Apprenticeship',
    xp1_desc:'Backend Java / Kotlin development on the <strong>MobilitX</strong> platform (transport & real-time data). Modular event-driven architecture.',
    xp2_title:'Fullstack Salesforce Developer – Apprenticeship',
    xp2_desc:'Client requirements analysis, Salesforce app development and configuration. CI/CD best practices.',
    xp3_title:'Fullstack Software Developer – Apprenticeship',
    xp3_desc:'Refactoring of the LUCY billing software. C++/Qt frontend, Python Flask backend. PL/SQL & CSV/XLSX imports.',
    xp4_title:'IT Technician – Internship',
    xp4_desc:'ERP document digitization, Java/SharePoint e-learning modules, technical support and workstation deployment.',
    proj_num:'04', proj_title:'Projects',
    filter_all:'All', filter_mobile:'Mobile', filter_iot:'IoT',
    filter_web:'Web & API', filter_rt:'Real-time',
    wip:'In progress',
    cert_num:'05', cert_title:'Education & Certifications',
    games_num:'06', games_title:'Mini-Games',
    games_intro:'A bit of fun? Play directly in your browser.',
    contact_num:'07', contact_title:'Contact',
    contact_lead:'Got a project, an opportunity, or just want to chat? I\'m available.',
    form_name:'Your name', form_email:'Your email', form_msg:'Your message...',
    form_send:'Send message',
    form_sending:'Sending…',
    form_sent:'✓ Message sent!',
    form_err_name:'Name is required',
    form_err_email:'Invalid email',
    form_err_msg:'Message is required',
    form_err_send:'Send error, please retry.',
    footer_hint:"Type 'sb' for an easter egg 🥚",
    stt_title:'Back to top',
    ee_welcome:'Welcome to Samy\'s terminal! 👾',
    ee_hint:"Type 'help' for commands.",
    cv_download:'Download my CV',
  }
};

let currentLang = 'fr';

function detectLang() {
  const saved = localStorage.getItem('sb-lang');
  if (saved) return saved;
  const nav = navigator.language || navigator.userLanguage || 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function t(key) {
  return TRANSLATIONS[currentLang][key] || TRANSLATIONS['fr'][key] || key;
}

function applyLang() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // update lang button
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = currentLang === 'fr' ? 'EN' : 'FR';
  localStorage.setItem('sb-lang', currentLang);
}

function toggleLang() {
  currentLang = currentLang === 'fr' ? 'en' : 'fr';
  applyLang();
}

function initI18n() {
  currentLang = detectLang();
  applyLang();
  document.getElementById('langBtn')?.addEventListener('click', toggleLang);
}

window.i18n = { init: initI18n, t, toggle: toggleLang };
