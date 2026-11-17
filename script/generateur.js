// --- CLÉS LOCALSTORAGE ---
const STORAGE_KEY_APP = 'app_school_data';
const STORAGE_KEY_SAVED_GROUPS = 'app_saved_groups';

function getAppData() {
  const data = localStorage.getItem(STORAGE_KEY_APP);
  return data ? JSON.parse(data) : { classes: [], activeClassId: null };
}

function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY_APP, JSON.stringify(data));
}

let appData = getAppData();
let activeSubject = null;
let currentPeople = []; // { id, name, score }
let currentExclusions = [];
let generatedGroups = [];

// --- ÉLÉMENTS DU DOM ---
const genClassSelect = document.getElementById('gen-class-select');
const genSubjectSelect = document.getElementById('gen-subject-select');
const btnSync = document.getElementById('btn-sync');
const currentSubjectLabel = document.getElementById('current-subject-label');

const peopleList = document.getElementById('people-list');
const totalParticipantsSpan = document.getElementById('total-participants');

const selectPersonA = document.getElementById('select-person-a');
const selectPersonB = document.getElementById('select-person-b');
const btnAddExclusion = document.getElementById('btn-add-exclusion');
const btnClearExclusions = document.getElementById('btn-clear-exclusions');
const exclusionsList = document.getElementById('exclusions-list');
const totalExclusionsSpan = document.getElementById('total-exclusions');

const groupCountInput = document.getElementById('group-count');
const btnGenerate = document.getElementById('btn-generate');
const groupsDisplay = document.getElementById('groups-display');

const btnExportGroups = document.getElementById('btn-export-groups');
const btnExportDoc = document.getElementById('btn-export-doc');
const importGroupsFile = document.getElementById('import-groups-file');

// Glisser-déposer : élève en cours de déplacement
let dragState = null;

// --- GESTION DE LA CLASSE & DES MATIÈRES ---

function getActiveClass() {
  return appData.classes.find(c => c.id === appData.activeClassId) || appData.classes[0];
}

function initSelectors() {
  appData = getAppData();
  if (!appData.classes || appData.classes.length === 0) {
    currentPeople = [];
    currentExclusions = [];
    renderAll();
    return;
  }

  // Sélecteur de classe
  genClassSelect.innerHTML = '';
  appData.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === appData.activeClassId) opt.selected = true;
    genClassSelect.appendChild(opt);
  });

  updateSubjectsDropdown();
}

function updateSubjectsDropdown() {
  const cls = getActiveClass();
  genSubjectSelect.innerHTML = '';

  if (!cls || !cls.subjects || cls.subjects.length === 0) {
    activeSubject = null;
    syncCurrentContext();
    return;
  }

  cls.subjects.forEach((subj, idx) => {
    const opt = document.createElement('option');
    opt.value = subj;
    opt.textContent = subj;
    if (idx === 0) opt.selected = true;
    genSubjectSelect.appendChild(opt);
  });

  activeSubject = genSubjectSelect.value;
  syncCurrentContext();
}

genClassSelect.addEventListener('change', () => {
  appData.activeClassId = genClassSelect.value;
  saveAppData(appData);
  updateSubjectsDropdown();
});

genSubjectSelect.addEventListener('change', () => {
  activeSubject = genSubjectSelect.value;
  syncCurrentContext();
});

if (btnSync) {
  btnSync.addEventListener('click', () => {
    initSelectors();
  });
}

// Synchronise les élèves et les exclusions pour la classe et la matière choisie
function syncCurrentContext() {
  const cls = getActiveClass();

  if (!cls || !activeSubject) {
    currentPeople = [];
    currentExclusions = [];
    generatedGroups = [];
    if (currentSubjectLabel) currentSubjectLabel.textContent = "aucune";
    renderAll();
    updateThresholdsBanner();
    renderResults();
    return;
  }

  if (currentSubjectLabel) currentSubjectLabel.textContent = activeSubject;

  // Extraire les personnes avec la note de la matière active
  currentPeople = (cls.students || []).map(s => ({
    id: s.id,
    name: s.name,
    score: s.scores && s.scores[activeSubject] !== undefined ? s.scores[activeSubject] : 10
  }));

  // Initialiser la collection d'exclusions si absente pour cette matière
  if (!cls.exclusions) cls.exclusions = {};
  if (!cls.exclusions[activeSubject]) cls.exclusions[activeSubject] = [];

  // Nettoyer les orphelins éventuels
  const validIds = new Set(currentPeople.map(p => p.id));
  cls.exclusions[activeSubject] = cls.exclusions[activeSubject].filter(
    e => validIds.has(e.personAId) && validIds.has(e.personBId)
  );

  currentExclusions = cls.exclusions[activeSubject];
  saveAppData(appData);

  renderAll();
  updateThresholdsBanner();
  loadSavedGroupsState();
}

function renderAll() {
  updatePeopleUI();
  updateSelectOptions();
  updateExclusionsUI();
}

function updatePeopleUI() {
  peopleList.innerHTML = '';
  totalParticipantsSpan.textContent = currentPeople.length;

  if (currentPeople.length === 0) {
    peopleList.innerHTML = `<li style="color: var(--text-muted); justify-content: center;">Aucun élève dans cette classe.</li>`;
    return;
  }

  currentPeople.forEach(person => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${person.name}</strong></span>
      <span>Note en ${activeSubject} : <strong>${person.score}</strong></span>
    `;
    peopleList.appendChild(li);
  });
}

function updateSelectOptions() {
  const populate = (selectElement) => {
    selectElement.innerHTML = '<option value="">Sélectionner une personne</option>';
    currentPeople.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.score})`;
      selectElement.appendChild(opt);
    });
  };

  populate(selectPersonA);
  populate(selectPersonB);
}

function updateExclusionsUI() {
  exclusionsList.innerHTML = '';
  totalExclusionsSpan.textContent = currentExclusions.length;

  if (currentExclusions.length === 0) {
    exclusionsList.innerHTML = `<li style="color: var(--text-muted); justify-content: center;">Aucune séparation pour ${activeSubject || ''}.</li>`;
    return;
  }

  currentExclusions.forEach(rule => {
    const pA = currentPeople.find(p => p.id === rule.personAId);
    const pB = currentPeople.find(p => p.id === rule.personBId);
    if (!pA || !pB) return;

    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${pA.name}</strong> ⚡ <strong>${pB.name}</strong></span>
      <button class="btn-remove" onclick="removeExclusion(${rule.id})">Supprimer</button>
    `;
    exclusionsList.appendChild(li);
  });
}

// Ajout d'exclusion pour la matière active
btnAddExclusion.addEventListener('click', () => {
  const idA = parseFloat(selectPersonA.value);
  const idB = parseFloat(selectPersonB.value);

  if (!idA || !idB) return alert("Sélectionnez deux élèves distincts.");
  if (idA === idB) return alert("Impossible de séparer un élève de lui-même.");

  const exists = currentExclusions.some(e => 
    (e.personAId === idA && e.personBId === idB) || 
    (e.personAId === idB && e.personBId === idA)
  );

  if (exists) return alert("Cette exclusion existe déjà pour cette matière.");

  const newRule = { id: Date.now(), personAId: idA, personBId: idB };
  currentExclusions.push(newRule);

  const cls = getActiveClass();
  cls.exclusions[activeSubject] = currentExclusions;
  saveAppData(appData);

  selectPersonA.value = '';
  selectPersonB.value = '';
  updateExclusionsUI();
});

window.removeExclusion = function(ruleId) {
  currentExclusions = currentExclusions.filter(e => e.id !== ruleId);
  const cls = getActiveClass();
  cls.exclusions[activeSubject] = currentExclusions;
  saveAppData(appData);
  updateExclusionsUI();
};

if (btnClearExclusions) {
  btnClearExclusions.addEventListener('click', () => {
    if (!currentExclusions || currentExclusions.length === 0) {
      return;
    }
    if (confirm(`Supprimer toutes les exclusions pour la matière ${activeSubject} ?`)) {
      currentExclusions = [];
      const cls = getActiveClass();
      if (cls && cls.exclusions) {
        cls.exclusions[activeSubject] = [];
      }
      saveAppData(appData);
      updateExclusionsUI();
    }
  });
}

// --- ALGORITHMES D'ÉQUILIBRAGE ---

function getGroupAverage(group) {
  if (!group || group.length === 0) return 0;
  return group.reduce((acc, p) => acc + p.score, 0) / group.length;
}

function hasConflict(group, exclusions) {
  const ids = new Set(group.map(p => p.id));
  return exclusions.some(e => ids.has(e.personAId) && ids.has(e.personBId));
}

function getVariance(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
}

const DEFAULT_STRONG = 15;
const DEFAULT_WEAK = 8;

/** Seuils fort/faible définis par matière dans le répertoire élèves. */
function getSubjectThresholds() {
  const cls = getActiveClass();
  if (!cls || !activeSubject) {
    return { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK };
  }
  if (!cls.subjectThresholds) cls.subjectThresholds = {};
  if (!cls.subjectThresholds[activeSubject]) {
    cls.subjectThresholds[activeSubject] = { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK };
  }
  const t = cls.subjectThresholds[activeSubject];
  return {
    strong: typeof t.strong === 'number' ? t.strong : DEFAULT_STRONG,
    weak: typeof t.weak === 'number' ? t.weak : DEFAULT_WEAK
  };
}

function countStrong(group, strongThreshold) {
  return group.filter(p => p.score >= strongThreshold).length;
}

function countWeak(group, weakThreshold) {
  return group.filter(p => p.score <= weakThreshold).length;
}

function getScoreLevel(score, thresholds) {
  if (score >= thresholds.strong) return 'strong';
  if (score <= thresholds.weak) return 'weak';
  return 'mid';
}

/**
 * Score composite :
 * - proximité des moyennes entre groupes
 * - répartition équitable des notes fortes et faibles (seuils matière)
 * - pénalité si un groupe est trop polarisé
 */
function calculateBalanceScore(groups, thresholds) {
  const avgs = groups.map(g => getGroupAverage(g));
  const avgVariance = getVariance(avgs);

  const strongCounts = groups.map(g => countStrong(g, thresholds.strong));
  const weakCounts = groups.map(g => countWeak(g, thresholds.weak));
  const strongVariance = getVariance(strongCounts);
  const weakVariance = getVariance(weakCounts);

  let internalSpread = 0;
  groups.forEach(g => {
    if (g.length < 2) return;
    const scores = g.map(p => p.score);
    internalSpread += getVariance(scores);
  });
  internalSpread /= groups.length;

  return avgVariance * 4 + strongVariance * 12 + weakVariance * 10 + internalSpread * 0.35;
}

function updateThresholdsBanner() {
  const banner = document.getElementById('thresholds-info');
  if (!banner) return;

  if (!activeSubject) {
    banner.hidden = true;
    return;
  }

  const t = getSubjectThresholds();
  banner.hidden = false;
  banner.innerHTML = `
    Seuils pour <strong>${activeSubject}</strong> :
    ★ fort ≥ <strong>${t.strong}</strong>
    · ▽ faible ≤ <strong>${t.weak}</strong>
    <span style="margin-left: 0.35rem;">(modifiables dans le répertoire élèves)</span>
  `;
}

function snakeSeedGroups(peopleList, k) {
  const sorted = [...peopleList].sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const groups = Array.from({ length: k }, () => []);
  let direction = 1;
  let g = 0;

  sorted.forEach(person => {
    groups[g].push(person);
    g += direction;
    if (g === k || g === -1) {
      direction *= -1;
      g += direction;
    }
  });

  return groups;
}

function improveBySwaps(groups, exclusionsList, thresholds, pinnedIds, maxSteps) {
  const k = groups.length;
  const pinned = pinnedIds || new Set();
  let improved = true;
  let localSteps = 0;

  while (improved && localSteps < maxSteps) {
    improved = false;
    localSteps++;

    outer:
    for (let g1 = 0; g1 < k; g1++) {
      for (let g2 = g1 + 1; g2 < k; g2++) {
        for (let i = 0; i < groups[g1].length; i++) {
          if (pinned.has(groups[g1][i].id)) continue;

          for (let j = 0; j < groups[g2].length; j++) {
            if (pinned.has(groups[g2][j].id)) continue;

            const currentScore = calculateBalanceScore(groups, thresholds);

            const temp = groups[g1][i];
            groups[g1][i] = groups[g2][j];
            groups[g2][j] = temp;

            const valid = !hasConflict(groups[g1], exclusionsList) && !hasConflict(groups[g2], exclusionsList);
            const nextScore = calculateBalanceScore(groups, thresholds);

            if (valid && nextScore < currentScore - 1e-9) {
              improved = true;
              break outer;
            }

            const roll = groups[g1][i];
            groups[g1][i] = groups[g2][j];
            groups[g2][j] = roll;
          }
        }
      }
    }
  }

  return groups;
}

function findBalancedGroups(peopleList, exclusionsList, k, pinnedByGroup, maxAttempts) {
  let globalBest = null;
  let globalScore = Infinity;
  const thresholds = getSubjectThresholds();
  const attempts = maxAttempts || 180;
  const pinnedIds = new Set();
  if (pinnedByGroup) {
    Object.values(pinnedByGroup).forEach(list => list.forEach(p => pinnedIds.add(p.id)));
  }

  for (let step = 0; step < attempts; step++) {
    let groups;

    if (pinnedByGroup) {
      groups = Array.from({ length: k }, (_, idx) => [...(pinnedByGroup[idx] || [])]);
      const freePeople = peopleList.filter(p => !pinnedIds.has(p.id));
      const shuffled = [...freePeople].sort((a, b) => {
        if (step === 0) return b.score - a.score;
        return Math.random() - 0.5;
      });

      // Répartition en serpentin en respectant les effectifs cibles
      const total = peopleList.length;
      const baseSize = Math.floor(total / k);
      const remainder = total % k;
      const targetSizes = Array.from({ length: k }, (_, i) => baseSize + (i < remainder ? 1 : 0));

      let gi = 0;
      shuffled.forEach(person => {
        let placed = false;
        for (let t = 0; t < k; t++) {
          const idx = (gi + t) % k;
          if (groups[idx].length < targetSizes[idx]) {
            groups[idx].push(person);
            gi = (idx + 1) % k;
            placed = true;
            break;
          }
        }
        if (!placed) {
          let smallest = 0;
          for (let t = 1; t < k; t++) {
            if (groups[t].length < groups[smallest].length) smallest = t;
          }
          groups[smallest].push(person);
        }
      });
    } else if (step % 3 === 0) {
      groups = snakeSeedGroups(peopleList, k);
    } else {
      const shuffled = [...peopleList].sort(() => Math.random() - 0.5);
      groups = Array.from({ length: k }, () => []);
      shuffled.forEach((p, idx) => groups[idx % k].push(p));
    }

    improveBySwaps(groups, exclusionsList, thresholds, pinnedIds, 220);

    if (groups.every(g => !hasConflict(g, exclusionsList))) {
      const score = calculateBalanceScore(groups, thresholds);
      if (score < globalScore) {
        globalScore = score;
        globalBest = groups.map(g => [...g]);
      }
    }
  }

  return globalBest;
}

/** Après un déplacement manuel : rééquilibrer en gardant l'élève déplacé fixé. */
function rebalanceAfterMove(groupsData, pinnedPersonId, pinnedGroupIndex) {
  const k = groupsData.length;
  const allMembers = groupsData.flatMap(g => g.members);
  const pinnedPerson = allMembers.find(p => p.id === pinnedPersonId);
  if (!pinnedPerson) return null;

  const pinnedByGroup = {};
  for (let i = 0; i < k; i++) pinnedByGroup[i] = [];
  pinnedByGroup[pinnedGroupIndex] = [pinnedPerson];

  // Moins d'essais qu'à la génération initiale pour rester réactif au glisser-déposer
  const solution = findBalancedGroups(allMembers, currentExclusions, k, pinnedByGroup, 80);
  if (!solution) return null;

  return solution.map((members, idx) => ({
    label: groupsData[idx].label,
    members
  }));
}

// Scission en deux à effectifs égaux (ou écart de 1 max)
function splitBalancedInTwo(members, exclusions) {
  const n = members.length;
  if (n < 2) return null;

  const solution = findBalancedGroups(members, exclusions, 2);
  if (!solution) return null;

  // Garantir des tailles aussi proches que possible
  const sizeA = Math.ceil(n / 2);
  const sizeB = Math.floor(n / 2);
  if (solution[0].length === sizeA && solution[1].length === sizeB) return solution;
  if (solution[0].length === sizeB && solution[1].length === sizeA) return [solution[1], solution[0]];
  return solution;
}

// --- BOUTON DE CRÉATION DES GROUPES ---
if (btnGenerate) {
  btnGenerate.addEventListener('click', () => {
    const numGroups = parseInt(groupCountInput.value, 10);

    if (currentPeople.length === 0) return alert("Aucun élève dans cette classe.");
    if (currentPeople.length < numGroups) return alert(`Il faut au moins ${numGroups} élèves pour créer ces groupes.`);

    const solution = findBalancedGroups(currentPeople, currentExclusions, numGroups);

    if (!solution) {
      alert("Impossible de constituer les groupes avec les exclusions imposées pour cette matière.");
      return;
    }

    generatedGroups = solution.map((m, idx) => ({
      label: `Groupe ${idx + 1}`,
      members: m
    }));

    saveCurrentGroupsState();
    renderResults();
  });
}

function splitGroup(index) {
  const target = generatedGroups[index];
  if (target.members.length < 2) return alert("Ce groupe ne contient pas assez d'élèves pour être scindé.");

  const sub = splitBalancedInTwo(target.members, currentExclusions);
  if (!sub) return alert("Impossible de diviser ce groupe en deux parts égales sans enfreindre les exclusions.");

  const grpA = { label: `${target.label} - A`, members: sub[0] };
  const grpB = { label: `${target.label} - B`, members: sub[1] };

  generatedGroups.splice(index, 1, grpA, grpB);
  saveCurrentGroupsState();
  renderResults();
}

function renderResults() {
  if (!groupsDisplay) return;
  groupsDisplay.innerHTML = '';

  if (generatedGroups.length === 0) {
    groupsDisplay.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;">Aucun groupe généré pour le moment.</p>`;
    return;
  }

  const thresholds = getSubjectThresholds();

  generatedGroups.forEach((grp, index) => {
    const avg = getGroupAverage(grp.members).toFixed(2);
    const strongCount = countStrong(grp.members, thresholds.strong);
    const weakCount = countWeak(grp.members, thresholds.weak);
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupIndex = String(index);

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      handleStudentDrop(index);
    });

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <h4>${grp.label} (${grp.members.length} élève${grp.members.length > 1 ? 's' : ''})</h4>
      <span class="group-average">Moy. ${avg} · ★ ${strongCount} · ▽ ${weakCount}</span>
    `;

    const ul = document.createElement('ul');
    const sortedMembers = [...grp.members].sort((a, b) => b.score - a.score);
    sortedMembers.forEach(p => {
      const li = document.createElement('li');
      li.className = 'student-item';
      li.draggable = true;
      li.dataset.personId = String(p.id);
      li.dataset.fromGroup = String(index);

      const level = getScoreLevel(p.score, thresholds);
      let levelBadge = '';
      if (level === 'strong') {
        li.classList.add('student-strong');
        levelBadge = '<span class="student-strong-badge" title="Note forte pour cette matière">★ Fort</span>';
      } else if (level === 'weak') {
        li.classList.add('student-weak');
        levelBadge = '<span class="student-weak-badge" title="Note faible pour cette matière">▽ Faible</span>';
      }

      li.innerHTML = `
        <span class="student-name" title="Glisser vers un autre groupe">
          ${p.name}${levelBadge}
        </span>
        <strong>${p.score}</strong>
      `;

      li.addEventListener('dragstart', (e) => {
        dragState = { personId: p.id, fromGroup: index };
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(p.id));
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        dragState = null;
        document.querySelectorAll('.group-card.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      ul.appendChild(li);
    });

    const splitBtn = document.createElement('button');
    splitBtn.textContent = '➗ Séparer en 2 à parts égales';
    splitBtn.style.marginTop = '0.75rem';
    splitBtn.style.width = '100%';
    splitBtn.disabled = grp.members.length < 2;
    splitBtn.onclick = () => splitGroup(index);

    card.appendChild(header);
    card.appendChild(ul);
    card.appendChild(splitBtn);
    groupsDisplay.appendChild(card);
  });
}

function handleStudentDrop(toGroupIndex) {
  if (!dragState) return;

  const { personId, fromGroup } = dragState;
  if (fromGroup === toGroupIndex) return;

  const source = generatedGroups[fromGroup];
  const person = source.members.find(p => p.id === personId);
  if (!person) return;

  // Test rapide : l'élève peut-il rejoindre le groupe cible sans conflit d'exclusion ?
  const trialTarget = [...generatedGroups[toGroupIndex].members, person];
  if (hasConflict(trialTarget, currentExclusions)) {
    alert("Impossible : cet élève ne peut pas rejoindre ce groupe (contrainte de séparation).");
    return;
  }

  // Déplacer puis rééquilibrer en le gardant fixé dans le nouveau groupe
  const working = generatedGroups.map((g, idx) => ({
    label: g.label,
    members: g.members.filter(p => !(idx === fromGroup && p.id === personId))
  }));
  working[toGroupIndex].members.push(person);

  const rebalanced = rebalanceAfterMove(working, personId, toGroupIndex);
  if (!rebalanced) {
    alert("Impossible de rééquilibrer les groupes avec les exclusions actuelles.");
    return;
  }

  generatedGroups = rebalanced;
  saveCurrentGroupsState();
  renderResults();
}

// --- PERSISTANCE DES GROUPES DANS LOCALSTORAGE ---

function saveCurrentGroupsState() {
  const payload = {
    classId: appData.activeClassId,
    subject: activeSubject,
    date: new Date().toISOString(),
    groups: generatedGroups
  };
  localStorage.setItem(STORAGE_KEY_SAVED_GROUPS, JSON.stringify(payload));
}

function loadSavedGroupsState() {
  const data = localStorage.getItem(STORAGE_KEY_SAVED_GROUPS);
  if (!data) return;

  try {
    const saved = JSON.parse(data);
    if (saved.classId === appData.activeClassId && saved.subject === activeSubject && saved.groups) {
      generatedGroups = saved.groups;
      renderResults();
    }
  } catch (err) {
    console.error("Erreur lors de la lecture des groupes sauvegardés :", err);
  }
}

function getExportFileBaseName() {
  const cls = getActiveClass();
  const cleanClassName = (cls ? cls.name : 'classe').replace(/\s+/g, '_');
  const cleanSubject = (activeSubject || 'matiere').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  return `groupes_${cleanClassName}_${cleanSubject}_${dateStr}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeRtf(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/[\u0080-\uFFFF]/g, (ch) => '\\u' + ch.charCodeAt(0) + '?');
}

/** Export RTF : s'ouvre dans Word, LibreOffice et OpenOffice. */
function buildGroupsRtf(includeScores) {
  const cls = getActiveClass();
  const className = cls ? cls.name : 'Classe';
  const dateLabel = new Date().toLocaleDateString('fr-FR');
  const lines = [];

  lines.push('{\\rtf1\\ansi\\deff0');
  lines.push('{\\fonttbl{\\f0 Calibri;}{\\f1 Arial;}}');
  lines.push('\\f0\\fs24');
  lines.push(`\\b ${escapeRtf('Groupes équilibrés')}\\b0\\par`);
  lines.push(`${escapeRtf('Classe : ' + className)}\\par`);
  lines.push(`${escapeRtf('Matière : ' + (activeSubject || '-'))}\\par`);
  lines.push(`${escapeRtf('Date : ' + dateLabel)}\\par\\par`);

  generatedGroups.forEach((grp) => {
    lines.push(`\\b ${escapeRtf(grp.label)}\\b0`);
    if (includeScores) {
      const avg = getGroupAverage(grp.members).toFixed(2);
      lines.push(` ${escapeRtf(`(${grp.members.length} élève${grp.members.length > 1 ? 's' : ''} — moyenne ${activeSubject || ''} : ${avg})`)}\\par`);
    } else {
      lines.push(` ${escapeRtf(`(${grp.members.length} élève${grp.members.length > 1 ? 's' : ''})`)}\\par`);
    }

    const sorted = [...grp.members].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    sorted.forEach((p) => {
      if (includeScores) {
        lines.push(`- ${escapeRtf(p.name)} : ${escapeRtf(String(p.score))}\\par`);
      } else {
        lines.push(`- ${escapeRtf(p.name)}\\par`);
      }
    });
    lines.push('\\par');
  });

  lines.push('}');
  return lines.join('\n');
}

const exportDocModal = document.getElementById('export-doc-modal');
const exportIncludeScores = document.getElementById('export-include-scores');
const btnConfirmExportDoc = document.getElementById('btn-confirm-export-doc');

function openExportDocModal() {
  if (!exportDocModal) return;
  if (exportIncludeScores) exportIncludeScores.checked = true;
  exportDocModal.hidden = false;
  if (exportIncludeScores) exportIncludeScores.focus();
}

function closeExportDocModal() {
  if (!exportDocModal) return;
  exportDocModal.hidden = true;
}

// --- EXPORT FICHIER (JSON) ---
if (btnExportGroups) {
  btnExportGroups.addEventListener('click', () => {
    if (!generatedGroups || generatedGroups.length === 0) {
      alert("Aucun groupe constitué à sauvegarder.");
      return;
    }

    const cls = getActiveClass();
    const exportPayload = {
      className: cls ? cls.name : "Classe",
      classId: appData.activeClassId,
      subject: activeSubject,
      savedAt: new Date().toISOString(),
      groups: generatedGroups
    };

    const dataStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `${getExportFileBaseName()}.json`);
  });
}

// --- EXPORT WORD / OPENOFFICE (RTF) ---
if (btnExportDoc) {
  btnExportDoc.addEventListener('click', () => {
    if (!generatedGroups || generatedGroups.length === 0) {
      alert("Aucun groupe constitué à exporter.");
      return;
    }
    openExportDocModal();
  });
}

if (exportDocModal) {
  exportDocModal.querySelectorAll('[data-close-export-modal]').forEach(el => {
    el.addEventListener('click', closeExportDocModal);
  });
}

if (btnConfirmExportDoc) {
  btnConfirmExportDoc.addEventListener('click', () => {
    const includeScores = exportIncludeScores ? exportIncludeScores.checked : true;
    const rtf = buildGroupsRtf(includeScores);
    const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8;' });
    downloadBlob(blob, `${getExportFileBaseName()}.rtf`);
    closeExportDocModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && exportDocModal && !exportDocModal.hidden) {
    closeExportDocModal();
  }
});

// --- IMPORT FICHIER (JSON) ---
if (importGroupsFile) {
  importGroupsFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
      try {
        const imported = JSON.parse(event.target.result);

        if (!imported.groups || !Array.isArray(imported.groups)) {
          throw new Error("Format de groupes non reconnu.");
        }

        generatedGroups = imported.groups;
        if (imported.subject) activeSubject = imported.subject;

        saveCurrentGroupsState();
        renderResults();
        alert(`Groupes restaurés : ${generatedGroups.length} groupe(s) chargé(s) avec succès !`);
      } catch (err) {
        alert("Erreur lors de la lecture du fichier de groupes.");
        console.error(err);
      } finally {
        importGroupsFile.value = '';
      }
    };

    reader.readAsText(file, 'utf-8');
  });
}

// Initialisation au chargement et au focus
document.addEventListener('DOMContentLoaded', initSelectors);
window.addEventListener('focus', initSelectors);