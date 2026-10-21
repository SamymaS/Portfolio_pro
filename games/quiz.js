/* ==================================================================
   games/quiz.js · Quiz tech
   Dix questions tirées d'une banque de trente, sur la pile réelle
   du propriétaire (C++/Qt, TETRA, Flutter/Dart, Supabase, Redis,
   Kubernetes, Terraform, Modbus, MQTT, ESP32, HTTP, Git).
   Chaque texte existe en français et en anglais ; la langue est
   choisie à l'affichage. Réponse 1 de chaque entrée = la bonne,
   l'ordre est mélangé au tirage.
   ================================================================== */
SBG.register('quiz', {
  create(api) {
    const t = api.t;
    const COUNT = 10, TIME = 15;
    const L = (v) => (Array.isArray(v) ? t(v[0], v[1]) : v);

    /* q: [fr, en] · a: 4 réponses (la première est juste) · x: explication */
    const BANK = [
      { q: ['Sur quel modèle de communication repose MQTT ?', 'What communication model does MQTT use?'],
        a: [['Publication/abonnement via un broker', 'Publish/subscribe through a broker'], ['Requête/réponse de pair à pair', 'Peer-to-peer request/response'], ['Interrogation périodique en UDP', 'Periodic polling over UDP'], ['Mémoire partagée entre clients', 'Memory shared between clients']],
        x: ['Les clients publient sur des topics ; le broker relaie chaque message aux abonnés.', 'Clients publish to topics; the broker relays each message to subscribers.'] },
      { q: ['Quel port est réservé à MQTT sur TLS ?', 'Which port is registered for MQTT over TLS?'],
        a: ['8883', '1883', '443', '5683'],
        x: ['1883 est le port MQTT en clair, 8883 sa version chiffrée. 5683 est celui de CoAP.', '1883 is plain MQTT, 8883 its encrypted twin. 5683 belongs to CoAP.'] },
      { q: ['Quel niveau de QoS MQTT garantit une livraison exactement une fois ?', 'Which MQTT QoS level guarantees exactly-once delivery?'],
        a: ['QoS 2', 'QoS 1', 'QoS 0', 'QoS 3'],
        x: ['QoS 0 : au plus une fois. QoS 1 : au moins une fois. QoS 2 : exactement une fois, au prix de quatre échanges.', 'QoS 0: at most once. QoS 1: at least once. QoS 2: exactly once, at the cost of a four-step handshake.'] },
      { q: ['Quelle puce intègre à la fois Wi-Fi et Bluetooth ?', 'Which chip has both Wi-Fi and Bluetooth built in?'],
        a: ['ESP32', 'ATmega328P', 'STM32F103', 'RP2040'],
        x: ['L\'ESP32 d\'Espressif embarque Wi-Fi et Bluetooth (classique et BLE). Les trois autres n\'ont pas de radio.', 'Espressif\'s ESP32 ships with Wi-Fi and Bluetooth (classic and BLE). The other three have no radio.'] },
      { q: ['Sur quelle liaison physique tourne le plus souvent Modbus RTU ?', 'Which physical link does Modbus RTU most often run on?'],
        a: ['RS-485', 'Ethernet', 'Bus CAN', 'USB'],
        x: ['Modbus RTU est un protocole série maître/esclave, typiquement sur RS-485. Sur Ethernet, on parle de Modbus TCP.', 'Modbus RTU is a serial master/slave protocol, typically over RS-485. Over Ethernet it becomes Modbus TCP.'] },
      { q: ['Comment une trame Modbus RTU est-elle contrôlée ?', 'How is a Modbus RTU frame checked for errors?'],
        a: [['Par un CRC-16', 'With a CRC-16'], ['Par un LRC', 'With an LRC'], ['Par un SHA-1', 'With a SHA-1'], ['Par la seule parité', 'With parity alone']],
        x: ['Le mode RTU utilise un CRC-16 ; le LRC appartient au mode Modbus ASCII.', 'RTU mode uses a CRC-16; the LRC belongs to Modbus ASCII mode.'] },
      { q: ['Qu\'est-ce que TETRA ?', 'What is TETRA?'],
        a: [['Une norme ETSI de radio numérique professionnelle', 'An ETSI standard for professional digital radio'], ['Une norme de téléphonie 4G', 'A 4G cellular standard'], ['Un système de positionnement par satellite', 'A satellite positioning system'], ['Un protocole de maillage Wi-Fi', 'A Wi-Fi mesh protocol']],
        x: ['TETRA (Terrestrial Trunked Radio) sert aux réseaux critiques : secours, transports, sécurité.', 'TETRA (Terrestrial Trunked Radio) serves mission-critical networks: emergency services, transport, security.'] },
      { q: ['Combien d\'intervalles de temps compte une porteuse TETRA de 25 kHz ?', 'How many time slots does a 25 kHz TETRA carrier have?'],
        a: ['4', '2', '8', '16'],
        x: ['TETRA découpe chaque porteuse en 4 slots TDMA. DMR en utilise 2, GSM 8.', 'TETRA splits each carrier into 4 TDMA slots. DMR uses 2, GSM 8.'] },
      { q: ['Dans Qt, quel mécanisme relie un événement d\'un objet à la réaction d\'un autre ?', 'In Qt, what connects an event in one object to a reaction in another?'],
        a: [['Les signaux et slots', 'Signals and slots'], ['Les délégués', 'Delegates'], ['Les promesses', 'Promises'], ['Les intents', 'Intents']],
        x: ['connect() relie un signal à un slot, y compris entre threads grâce aux connexions mises en file.', 'connect() ties a signal to a slot, even across threads thanks to queued connections.'] },
      { q: ['Quel outil Qt génère le code méta-objet des classes Q_OBJECT ?', 'Which Qt tool generates meta-object code for Q_OBJECT classes?'],
        a: ['moc', 'uic', 'rcc', 'qmake'],
        x: ['moc produit le code des signaux, slots et propriétés. uic compile les fichiers .ui, rcc les ressources.', 'moc emits the code for signals, slots and properties. uic compiles .ui files, rcc the resources.'] },
      { q: ['Que garantit l\'idiome RAII en C++ ?', 'What does the RAII idiom guarantee in C++?'],
        a: [['La libération d\'une ressource à la destruction de son propriétaire', 'A resource is released when its owner is destroyed'], ['L\'allocation de tous les objets sur le tas', 'Every object is allocated on the heap'], ['Un ramasse-miettes à l\'exécution', 'A runtime garbage collector'], ['L\'absence d\'exceptions', 'No exceptions are thrown']],
        x: ['Le destructeur libère la ressource, même si une exception interrompt le bloc.', 'The destructor releases the resource, even when an exception unwinds the scope.'] },
      { q: ['Quel pointeur intelligent exprime une propriété exclusive ?', 'Which smart pointer expresses exclusive ownership?'],
        a: ['std::unique_ptr', 'std::shared_ptr', 'std::weak_ptr', 'std::auto_ptr'],
        x: ['unique_ptr se déplace mais ne se copie pas. shared_ptr compte les références ; auto_ptr a été retiré en C++17.', 'unique_ptr can be moved but not copied. shared_ptr counts references; auto_ptr was removed in C++17.'] },
      { q: ['En Flutter, quelle méthode demande la reconstruction d\'un StatefulWidget ?', 'In Flutter, which method asks a StatefulWidget to rebuild?'],
        a: ['setState()', 'initState()', 'dispose()', 'createState()'],
        x: ['setState() marque l\'état comme modifié ; Flutter rappelle build() à l\'image suivante.', 'setState() marks the state dirty; Flutter calls build() again on the next frame.'] },
      { q: ['En Dart, que signifie le mot-clé late ?', 'In Dart, what does the late keyword mean?'],
        a: [['La variable sera initialisée avant sa première lecture', 'The variable will be set before it is first read'], ['La variable est calculée en tâche de fond', 'The variable is computed in the background'], ['La variable est constante à la compilation', 'The variable is a compile-time constant'], ['La variable peut valoir null', 'The variable may be null']],
        x: ['Lire une variable late encore vide lève une erreur à l\'exécution.', 'Reading a late variable before it is set throws at runtime.'] },
      { q: ['Comment Flutter compile-t-il une application mobile en release ?', 'How does Flutter compile a mobile app in release mode?'],
        a: [['En code machine natif, AOT', 'Ahead of time, to native machine code'], ['En JavaScript interprété', 'To interpreted JavaScript'], ['En bytecode pour la JVM', 'To JVM bytecode'], ['Uniquement en WebAssembly', 'To WebAssembly only']],
        x: ['En debug, Dart tourne en JIT pour le hot reload ; en release, il est compilé AOT.', 'In debug, Dart runs JIT for hot reload; in release it is compiled ahead of time.'] },
      { q: ['Dans Supabase, que fait la Row Level Security ?', 'In Supabase, what does Row Level Security do?'],
        a: [['Filtre les lignes visibles selon des politiques PostgreSQL', 'Filters visible rows through PostgreSQL policies'], ['Chiffre les disques de la base', 'Encrypts the database disks'], ['Place un pare-feu réseau devant l\'API', 'Puts a network firewall in front of the API'], ['Sauvegarde chaque ligne séparément', 'Backs up each row separately']],
        x: ['Une fois RLS activée, chaque requête ne voit que les lignes permises, par exemple auth.uid() = user_id.', 'With RLS on, each query only sees permitted rows, for example auth.uid() = user_id.'] },
      { q: ['Dans une politique RLS Supabase, quelle fonction renvoie l\'id de l\'utilisateur connecté ?', 'In a Supabase RLS policy, which function returns the signed-in user\'s id?'],
        a: ['auth.uid()', 'auth.role()', 'request.user_id()', 'get_current_user()'],
        x: ['auth.uid() lit le claim sub du JWT. auth.role() renvoie le rôle : anon ou authenticated.', 'auth.uid() reads the sub claim of the JWT. auth.role() returns the role: anon or authenticated.'] },
      { q: ['Quel type d\'index PostgreSQL crée CREATE INDEX par défaut ?', 'Which PostgreSQL index type does CREATE INDEX build by default?'],
        a: ['B-tree', 'Hash', 'GIN', 'BRIN'],
        x: ['Le B-tree couvre égalités, plages et tri. GIN sert aux tableaux et au JSONB, BRIN aux très grandes tables ordonnées.', 'B-tree handles equality, ranges and sorting. GIN suits arrays and JSONB, BRIN huge naturally ordered tables.'] },
      { q: ['Quelle commande Redis pose un verrou simple, atomique et à durée limitée ?', 'Which Redis command takes a simple, atomic lock with a timeout?'],
        a: ['SET lock id NX PX 30000', 'GET lock, puis SET lock id', 'INCR lock', 'EXPIRE lock 30'],
        x: ['NX ne crée la clé que si elle est absente, PX ajoute un TTL : le verrou tombe même si son détenteur plante.', 'NX only creates the key if absent, PX adds a TTL: the lock expires even if its holder crashes.'] },
      { q: ['Pourquoi libérer un verrou Redis avec un script Lua plutôt qu\'un simple DEL ?', 'Why release a Redis lock with a Lua script rather than a plain DEL?'],
        a: [['Pour ne supprimer la clé que si elle nous appartient encore', 'To delete the key only if we still own it'], ['Parce que DEL n\'existe pas en cluster', 'Because DEL does not exist in cluster mode'], ['Pour accélérer la suppression', 'To make the delete faster'], ['Pour chiffrer la valeur du verrou', 'To encrypt the lock value']],
        x: ['Si notre TTL a expiré, un autre client peut tenir le verrou : le script compare la valeur avant de supprimer, en une seule opération.', 'If our TTL expired, another client may hold the lock: the script checks the value and deletes in one atomic step.'] },
      { q: ['Quel objet Kubernetes maintient N Pods identiques et gère les mises à jour progressives ?', 'Which Kubernetes object keeps N identical Pods running and handles rolling updates?'],
        a: ['Deployment', 'Service', 'ConfigMap', 'Ingress'],
        x: ['Un Deployment pilote des ReplicaSets. Un Service expose les Pods, un Ingress route le trafic HTTP.', 'A Deployment drives ReplicaSets. A Service exposes Pods, an Ingress routes HTTP traffic.'] },
      { q: ['Quelle sonde Kubernetes retire un Pod du trafic sans le redémarrer ?', 'Which Kubernetes probe takes a Pod out of traffic without restarting it?'],
        a: ['readinessProbe', 'livenessProbe', 'startupProbe', 'healthProbe'],
        x: ['Une readiness en échec retire le Pod des endpoints ; une liveness en échec le fait redémarrer.', 'A failing readiness probe removes the Pod from endpoints; a failing liveness probe restarts it.'] },
      { q: ['À quoi sert le fichier d\'état de Terraform ?', 'What is Terraform\'s state file for?'],
        a: [['Associer chaque ressource déclarée à la ressource réelle', 'Mapping each declared resource to the real one'], ['Stocker le code source des modules', 'Storing module source code'], ['Lister les variables d\'environnement', 'Listing environment variables'], ['Journaliser les commandes lancées', 'Logging the commands that were run']],
        x: ['Terraform compare configuration, state et infrastructure réelle pour calculer le plan.', 'Terraform compares configuration, state and real infrastructure to compute the plan.'] },
      { q: ['Que fait terraform plan ?', 'What does terraform plan do?'],
        a: [['Affiche les changements prévus sans les appliquer', 'Shows the planned changes without applying them'], ['Crée les ressources', 'Creates the resources'], ['Télécharge les providers', 'Downloads the providers'], ['Détruit l\'infrastructure', 'Destroys the infrastructure']],
        x: ['plan est une prévisualisation. init télécharge les providers, apply exécute les changements.', 'plan is a dry run. init downloads providers, apply carries out the changes.'] },
      { q: ['Quel code HTTP indique qu\'une ressource a été créée ?', 'Which HTTP status code means a resource was created?'],
        a: ['201', '200', '204', '302'],
        x: ['201 Created, souvent avec un en-tête Location. 204 signifie un succès sans corps de réponse.', '201 Created, often with a Location header. 204 means success with no response body.'] },
      { q: ['Laquelle de ces méthodes HTTP n\'est pas idempotente ?', 'Which of these HTTP methods is not idempotent?'],
        a: ['POST', 'PUT', 'DELETE', 'GET'],
        x: ['Rejouer un PUT ou un DELETE laisse le même état ; rejouer un POST peut créer un doublon.', 'Replaying a PUT or DELETE leaves the same state; replaying a POST can create a duplicate.'] },
      { q: ['Quelle est la différence entre les codes 401 et 403 ?', 'What is the difference between 401 and 403?'],
        a: [['401 : non authentifié. 403 : authentifié mais non autorisé', '401: not authenticated. 403: authenticated but not allowed'], ['401 : non autorisé. 403 : non authentifié', '401: not allowed. 403: not authenticated'], ['401 : serveur indisponible. 403 : ressource absente', '401: server down. 403: resource missing'], ['Aucune, ce sont des synonymes', 'None, they are synonyms']],
        x: ['401 invite à s\'identifier ; 403 refuse même avec une identité valide.', '401 asks you to authenticate; 403 refuses even with a valid identity.'] },
      { q: ['Comment s\'ouvre une connexion WebSocket ?', 'How does a WebSocket connection start?'],
        a: [['Par une requête HTTP avec l\'en-tête Upgrade', 'With an HTTP request carrying an Upgrade header'], ['Par un échange TLS dédié sur UDP', 'With a dedicated TLS exchange over UDP'], ['Par une requête DNS spéciale', 'With a special DNS query'], ['Par du long polling', 'With long polling']],
        x: ['Le serveur répond 101 Switching Protocols, puis le canal devient bidirectionnel.', 'The server answers 101 Switching Protocols, then the channel becomes bidirectional.'] },
      { q: ['Que fait git rebase main depuis une branche de fonctionnalité ?', 'What does git rebase main do from a feature branch?'],
        a: [['Rejoue les commits de la branche par-dessus main', 'Replays the branch\'s commits on top of main'], ['Fusionne main avec un commit de merge', 'Merges main with a merge commit'], ['Supprime les commits de la branche', 'Deletes the branch\'s commits'], ['Crée un tag sur main', 'Creates a tag on main']],
        x: ['L\'historique devient linéaire, mais les commits sont réécrits : à éviter sur une branche partagée.', 'History becomes linear, but commits are rewritten: avoid it on a shared branch.'] },
      { q: ['Quelle commande annule un commit déjà poussé sans réécrire l\'historique ?', 'Which command undoes a pushed commit without rewriting history?'],
        a: ['git revert', 'git reset --hard', 'git commit --amend', 'git stash'],
        x: ['revert crée un nouveau commit inverse. reset et amend réécrivent l\'historique.', 'revert adds a new inverse commit. reset and amend rewrite history.'] },
      { q: ['Que signifie RBAC ?', 'What does RBAC stand for?'],
        a: ['Role-Based Access Control', 'Remote Backend Access Config', 'Runtime Binary Access Check', 'Route-Bound API Controller'],
        x: ['Les droits sont attachés à des rôles, puis les rôles aux utilisateurs, comme dans Kubernetes.', 'Permissions attach to roles, and roles to users, as in Kubernetes.'] },
    ];

    const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    /* ── Interface ───────────────────────────────────────────── */
    const root = document.createElement('div');
    root.className = 'q-root';
    root.innerHTML = `
<style>
.g-stage:has(> .q-root){justify-content:flex-start}
.q-root{width:100%;max-width:600px;margin-block:auto;display:grid;gap:1.1rem}
.q-top{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.q-dots{display:flex;gap:6px;flex-wrap:wrap}
.q-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.1);transition:background .3s,transform .3s cubic-bezier(.2,.8,.2,1)}
.q-dot.cur{background:var(--ink);transform:scale(1.25)}
.q-dot.ok{background:var(--c2)}
.q-dot.ko{background:#FF7B72}
.q-count{font-size:.86rem;color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap}
.q-count b{color:var(--ink);font-weight:650}
.q-timer{height:4px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.q-timer i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--c2),#1F6FEB);transform-origin:0 50%;will-change:transform}
.q-timer.low i{background:linear-gradient(90deg,#FFA657,#FF7B72)}
.q-card{display:grid;gap:1rem}
.q-text{font-size:clamp(1.12rem,3.6vw,1.38rem);font-weight:700;line-height:1.35;letter-spacing:-.01em;color:var(--ink);min-height:2.7em}
.q-answers{display:grid;gap:.6rem}
.q-root .g-choice{display:flex;align-items:center;gap:.8rem;width:100%;font-weight:550;line-height:1.35}
.q-root .g-choice kbd{flex:none;display:grid;place-items:center;width:1.7rem;height:1.7rem;padding:0;border-radius:8px;font-size:.78rem;color:var(--muted)}
.q-root .g-choice.ok kbd{color:#3FB950;border-color:rgba(63,185,80,.5)}
.q-root .g-choice.ko kbd{color:#FF7B72;border-color:rgba(255,123,114,.5)}
.q-root .g-choice:disabled{cursor:default}
.q-root .g-choice.dim{opacity:.45}
.q-fb{display:grid;gap:.35rem;padding:.9rem 1rem;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025)}
.q-fb b{font-weight:700}
.q-fb.ok b{color:#3FB950}.q-fb.ko b{color:#FF7B72}
.q-fb p{color:var(--muted);font-size:.93rem;line-height:1.5}
.q-next{display:flex;justify-content:flex-end;align-items:center;gap:.8rem}
.q-next .g-btn{margin-top:0}
.q-next small{color:var(--faint);font-size:.8rem}
.q-in{animation:q-in .35s cubic-bezier(.2,.8,.2,1) both}
@keyframes q-in{from{opacity:0;transform:translateY(8px)}}
.q-end{display:grid;gap:1.1rem;text-align:center;justify-items:center}
.q-kicker{font-size:.8rem;color:var(--c2);font-weight:600;min-height:1em}
.q-score{font-size:clamp(3rem,12vw,4.4rem);font-weight:800;font-stretch:120%;line-height:1;letter-spacing:-.03em;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.q-score small{font-size:.4em;color:var(--faint);-webkit-text-fill-color:var(--faint)}
.q-sub{color:var(--muted)}
.q-review{width:100%;text-align:left;display:grid;gap:.6rem}
.q-review h3{font-size:.85rem;color:var(--faint);font-weight:600}
.q-rev{padding:.85rem 1rem;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.02);display:grid;gap:.3rem;font-size:.92rem;line-height:1.45}
.q-rev .qq{color:var(--ink);font-weight:600}
.q-rev .yy{color:#FF7B72}
.q-rev .cc{color:#3FB950}
.q-rev .yy span,.q-rev .cc span{color:var(--faint);margin-right:.35rem}
@media (max-width:560px){.q-root{gap:.9rem}.q-next small{display:none}}
@media (prefers-reduced-motion: reduce){.q-in{animation:none}}
</style>
<div class="q-play">
  <div class="q-top"><div class="q-dots"></div><span class="q-count"></span></div>
  <div class="q-timer" aria-hidden="true"><i></i></div>
  <div class="q-card">
    <p class="q-text" aria-live="polite"></p>
    <div class="q-answers"></div>
    <div class="q-slot"></div>
  </div>
</div>`;
    api.stage.appendChild(root);
    const play = root.querySelector('.q-play');
    play.style.display = 'grid'; play.style.gap = '1.1rem';
    const dots = root.querySelector('.q-dots'), count = root.querySelector('.q-count');
    const timerWrap = root.querySelector('.q-timer'), bar = timerWrap.querySelector('i');
    const qText = root.querySelector('.q-text'), answersEl = root.querySelector('.q-answers'), slot = root.querySelector('.q-slot');
    const card = root.querySelector('.q-card');
    for (let i = 0; i < COUNT; i++) { const d = document.createElement('span'); d.className = 'q-dot'; dots.appendChild(d); }

    let set, idx, score, left, state, answers, results, endEl = null, nextBtn = null;

    function start() {
      set = shuffle(BANK).slice(0, COUNT);
      idx = 0; score = 0; results = [];
      if (endEl) { endEl.remove(); endEl = null; }
      play.style.display = 'grid';
      api.hud({ score: 0, scoreLabel: t('Score', 'Score') });
      api.status('');
      show();
    }

    function show() {
      const it = set[idx];
      state = 'ask'; left = TIME;
      [...dots.children].forEach((d, i) => {
        d.className = 'q-dot' + (i < results.length ? (results[i].ok ? ' ok' : ' ko') : i === idx ? ' cur' : '');
      });
      count.innerHTML = '';
      count.append(t('Question ', 'Question '));
      const b = document.createElement('b'); b.textContent = (idx + 1) + ' / ' + COUNT; count.appendChild(b);
      timerWrap.classList.remove('low');
      bar.style.transform = 'scaleX(1)';
      qText.textContent = L(it.q);
      answersEl.innerHTML = ''; slot.innerHTML = ''; nextBtn = null;
      answers = shuffle(it.a.map((a, i) => ({ raw: a, text: L(a), ok: i === 0 })));
      answers.forEach((a, i) => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'g-choice';
        btn.innerHTML = '<kbd>' + (i + 1) + '</kbd><span></span>';
        btn.querySelector('span').textContent = a.text;
        btn.addEventListener('click', () => answer(i));   // élément recréé à chaque question
        answersEl.appendChild(btn);
      });
      card.classList.remove('q-in'); void card.offsetWidth; card.classList.add('q-in');
      loop.start();
    }

    function answer(i) {
      if (state !== 'ask') return;
      state = 'shown';
      loop.stop();
      const it = set[idx];
      const btns = [...answersEl.children];
      const right = answers.findIndex((a) => a.ok);
      const ok = i === right;
      btns.forEach((b, k) => {
        b.disabled = true;
        if (k === right) b.classList.add('ok');
        else if (k === i) b.classList.add('ko');
        else b.classList.add('dim');
      });
      if (ok) { score++; api.sfx('score'); api.hud({ score }); }
      else { api.sfx(i < 0 ? 'lose' : 'error'); if (i >= 0) api.shake(3); }
      results.push({ ok, q: it.q, your: i >= 0 ? answers[i].raw : null, right: it.a[0], x: it.x });
      dots.children[idx].className = 'q-dot ' + (ok ? 'ok' : 'ko');

      const fb = document.createElement('div');
      fb.className = 'q-fb q-in ' + (ok ? 'ok' : 'ko');
      const head = document.createElement('b');
      head.textContent = ok ? t('Bonne réponse', 'Correct') : i < 0 ? t('Temps écoulé', 'Time is up') : t('Pas tout à fait', 'Not quite');
      const p = document.createElement('p'); p.textContent = L(it.x);
      fb.append(head, p);
      const nx = document.createElement('div'); nx.className = 'q-next q-in';
      const hint = document.createElement('small'); hint.textContent = t('Entrée pour continuer', 'Enter to continue');
      nextBtn = document.createElement('button'); nextBtn.type = 'button'; nextBtn.className = 'g-btn';
      nextBtn.textContent = idx + 1 < COUNT ? t('Question suivante', 'Next question') : t('Voir le résultat', 'See results');
      nextBtn.addEventListener('click', next);
      nx.append(hint, nextBtn);
      slot.append(fb, nx);
      setTimeout(() => { if (nextBtn) { nextBtn.focus({ preventScroll: true }); nx.scrollIntoView({ block: 'nearest', behavior: api.reduced ? 'auto' : 'smooth' }); } }, 60);
    }

    function next() {
      if (state !== 'shown') return;
      idx++;
      if (idx < COUNT) show(); else finish();
    }

    function finish() {
      state = 'end'; loop.stop();
      play.style.display = 'none';
      const record = api.setBest(score);
      if (score === COUNT) api.unlock('quiz_master');
      api.sfx(score >= 7 ? 'win' : score >= 4 ? 'score' : 'lose');
      endEl = document.createElement('div');
      endEl.className = 'q-end q-in';
      const k = document.createElement('p'); k.className = 'q-kicker';
      k.textContent = record && score > 0 ? t('Nouveau record', 'New best') : (api.best !== null ? t('Record : ', 'Best: ') + api.best + ' / ' + COUNT : '');
      const s = document.createElement('p'); s.className = 'q-score';
      s.innerHTML = score + '<small> / ' + COUNT + '</small>';
      const sub = document.createElement('p'); sub.className = 'q-sub';
      sub.textContent = score === COUNT ? t('Sans faute.', 'Flawless.') : score >= 7 ? t('Très solide.', 'Very solid.') : score >= 4 ? t('Pas mal, la revue ci-dessous aide.', 'Not bad, the review below helps.') : t('La revue ci-dessous vaut le détour.', 'The review below is worth a look.');
      endEl.append(k, s, sub);
      const wrong = results.filter((r) => !r.ok);
      if (wrong.length) {
        const rv = document.createElement('div'); rv.className = 'q-review';
        const h = document.createElement('h3'); h.textContent = t('À revoir', 'To review'); rv.appendChild(h);
        wrong.forEach((r) => {
          const c = document.createElement('div'); c.className = 'q-rev';
          const qq = document.createElement('span'); qq.className = 'qq'; qq.textContent = L(r.q);
          const yy = document.createElement('span'); yy.className = 'yy';
          yy.innerHTML = '<span></span>'; yy.firstChild.textContent = t('Vous', 'You');
          yy.append(r.your ? L(r.your) : t('pas de réponse', 'no answer'));
          const cc = document.createElement('span'); cc.className = 'cc';
          cc.innerHTML = '<span></span>'; cc.firstChild.textContent = t('Réponse', 'Answer');
          cc.append(L(r.right));
          c.append(qq, yy, cc);
          rv.appendChild(c);
        });
        endEl.appendChild(rv);
      }
      const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn';
      again.textContent = t('Rejouer', 'Play again');
      again.addEventListener('click', start);
      endEl.appendChild(again);
      root.appendChild(endEl);
      api.stage.scrollTop = 0;
      setTimeout(() => again.focus({ preventScroll: true }), 60);
    }

    const loop = api.loop({
      update(dt) {
        if (state !== 'ask') return;
        left -= dt;
        if (left <= 0) { left = 0; answer(-1); }
      },
      render() {
        bar.style.transform = 'scaleX(' + Math.max(0, left / TIME).toFixed(4) + ')';
        timerWrap.classList.toggle('low', left <= 5);
      },
    });

    api.onKey((e) => {
      if (e.repeat) return;
      if (api.stage.querySelector('.g-overlay')) return;
      if (state === 'ask') {
        const i = ['1', '2', '3', '4'].indexOf(e.key);
        if (i >= 0) answer(i);
        return;
      }
      if (state === 'shown' && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault();   // évite le double déclenchement avec le bouton focalisé
        next();
      }
    });

    // accueil
    state = 'idle';
    set = []; results = [];
    qText.textContent = ''; count.textContent = '';
    bar.style.transform = 'scaleX(1)';
    api.overlay({
      title: t('Quiz tech', 'Tech quiz'),
      text: t('Dix questions sur ma pile : C++/Qt, radio TETRA, Flutter, Supabase, Kubernetes, IoT. Quinze secondes chacune.',
        'Ten questions on my stack: C++/Qt, TETRA radio, Flutter, Supabase, Kubernetes, IoT. Fifteen seconds each.'),
      action: t('Commencer', 'Start'),
      onAction: start,
    });

    return { restart: start };
  },
});
