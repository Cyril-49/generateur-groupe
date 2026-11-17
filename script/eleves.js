const STORAGE_KEY_APP = 'app_school_data';

// Récupération ou initialisation des données
function getAppData() {
  const data = localStorage.getItem(STORAGE_KEY_APP);
  if (data) return JSON.parse(data);

  // Structure de base par défaut
  const defaultData = {
    activeClassId: "classe-1",
    classes: [
      {
        id: "classe-1",
        name: "Classe 1",
        subjects: ["Général", "EPS", "Maths"],
        subjectThresholds: {
          "Général": { strong: 15, weak: 8 },
          "EPS": { strong: 15, weak: 8 },
          "Maths": { strong: 15, weak: 8 }
        },
        students: [],
        exclusions: {} // { "EPS": [ {id, personAId, personBId} ], "Maths": [] }
      }
    ]
  };
  saveAppData(defaultData);
  return defaultData;
}

const DEFAULT_STRONG = 15;
const DEFAULT_WEAK = 8;

/** Assure la présence des seuils fort/faible pour chaque matière. */
function ensureSubjectThresholds(cls) {
  if (!cls.subjectThresholds) cls.subjectThresholds = {};
  (cls.subjects || []).forEach(subject => {
    if (!cls.subjectThresholds[subject]) {
      cls.subjectThresholds[subject] = { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK };
    } else {
      const t = cls.subjectThresholds[subject];
      if (typeof t.strong !== 'number') t.strong = DEFAULT_STRONG;
      if (typeof t.weak !== 'number') t.weak = DEFAULT_WEAK;
    }
  });
  return cls.subjectThresholds;
}

function getSubjectLevel(score, subject, cls) {
  const thresholds = ensureSubjectThresholds(cls)[subject] || { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK };
  if (score >= thresholds.strong) return 'strong';
  if (score <= thresholds.weak) return 'weak';
  return 'mid';
}

function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY_APP, JSON.stringify(data));
}

let appData = getAppData();

// Éléments du DOM
const classSelect = document.getElementById('class-select');
const newClassNameInput = document.getElementById('new-class-name');
const btnAddClass = document.getElementById('btn-add-class');
const btnDeleteClass = document.getElementById('btn-delete-class');

const newSubjectNameInput = document.getElementById('new-subject-name');
const btnAddSubject = document.getElementById('btn-add-subject');
const subjectsList = document.getElementById('subjects-list');

const studentForm = document.getElementById('student-form');
const studentNameInput = document.getElementById('student-name');
const subjectScoresInputs = document.getElementById('subject-scores-inputs');
const studentsList = document.getElementById('students-list');
const totalStudentsSpan = document.getElementById('total-students');

function getActiveClass() {
  return appData.classes.find(c => c.id === appData.activeClassId) || appData.classes[0];
}

// 1. Classes
function renderClassesSelect() {
  classSelect.innerHTML = '';
  appData.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === appData.activeClassId) opt.selected = true;
    classSelect.appendChild(opt);
  });
}

classSelect.addEventListener('change', () => {
  appData.activeClassId = classSelect.value;
  saveAppData(appData);
  refreshUI();
});

btnAddClass.addEventListener('click', () => {
  const name = newClassNameInput.value.trim();
  if (!name) return;

  const newClass = {
    id: 'class_' + Date.now(),
    name,
    subjects: ["Général"],
    subjectThresholds: {
      "Général": { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK }
    },
    students: [],
    exclusions: {}
  };

  appData.classes.push(newClass);
  appData.activeClassId = newClass.id;
  saveAppData(appData);
  newClassNameInput.value = '';
  refreshUI();
});

btnDeleteClass.addEventListener('click', () => {
  if (appData.classes.length <= 1) {
    alert("Vous devez conserver au moins une classe.");
    return;
  }
  const current = getActiveClass();
  if (confirm(`Supprimer la classe "${current.name}" et tous ses élèves ?`)) {
    appData.classes = appData.classes.filter(c => c.id !== current.id);
    appData.activeClassId = appData.classes[0].id;
    saveAppData(appData);
    refreshUI();
  }
});

// 2. Matières + seuils fort / faible
function renderSubjects() {
  const current = getActiveClass();
  const thresholds = ensureSubjectThresholds(current);
  subjectsList.innerHTML = '';
  subjectScoresInputs.innerHTML = '';

  current.subjects.forEach(subject => {
    const t = thresholds[subject];
    const li = document.createElement('li');
    li.className = 'subject-threshold-row';
    li.innerHTML = `
      <span class="subject-name">${subject}</span>
      <div>
        <label>
          ★ Fort à partir de
          <input type="number" step="0.5" min="0" max="100" data-subject="${subject}" data-kind="strong" value="${t.strong}">
        </label>
        <label>
          ▽ Faible jusqu’à
          <input type="number" step="0.5" min="0" max="100" data-subject="${subject}" data-kind="weak" value="${t.weak}">
        </label>
        <button type="button" class="btn-remove" onclick="removeSubject('${subject}')">✕</button>
      </div>
    `;
    subjectsList.appendChild(li);

    li.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('change', () => {
        updateSubjectThreshold(subject, input.dataset.kind, input.value);
      });
    });

    const div = document.createElement('div');
    div.style.flex = '1';
    div.style.minWidth = '120px';
    div.innerHTML = `
      <label style="font-size: 0.8rem; display: block; color: var(--text-muted);">${subject}</label>
      <input type="number" step="0.5" min="0" max="100" placeholder="Note" data-subject="${subject}" required>
    `;
    subjectScoresInputs.appendChild(div);
  });
}

function updateSubjectThreshold(subject, kind, rawValue) {
  const current = getActiveClass();
  const thresholds = ensureSubjectThresholds(current);
  let value = parseFloat(rawValue);
  if (isNaN(value)) value = kind === 'strong' ? DEFAULT_STRONG : DEFAULT_WEAK;
  value = Math.max(0, Math.min(100, value));

  thresholds[subject][kind] = value;

  if (thresholds[subject].weak > thresholds[subject].strong) {
    if (kind === 'strong') thresholds[subject].weak = value;
    else thresholds[subject].strong = value;
  }

  saveAppData(appData);
  renderSubjects();
  renderStudents();
}

btnAddSubject.addEventListener('click', () => {
  const name = newSubjectNameInput.value.trim();
  const current = getActiveClass();
  if (!name) return;
  if (current.subjects.includes(name)) {
    alert("Cette matière existe déjà dans cette classe.");
    return;
  }

  current.subjects.push(name);
  ensureSubjectThresholds(current);
  current.subjectThresholds[name] = { strong: DEFAULT_STRONG, weak: DEFAULT_WEAK };
  saveAppData(appData);
  newSubjectNameInput.value = '';
  renderSubjects();
});

window.removeSubject = function(subjectName) {
  const current = getActiveClass();
  if (current.subjects.length <= 1) {
    alert("Conservez au moins une matière.");
    return;
  }
  if (confirm(`Supprimer la matière "${subjectName}" ? Les notes associées seront perdues.`)) {
    current.subjects = current.subjects.filter(s => s !== subjectName);
    current.students.forEach(st => {
      delete st.scores[subjectName];
    });
    if (current.exclusions) delete current.exclusions[subjectName];
    if (current.subjectThresholds) delete current.subjectThresholds[subjectName];
    saveAppData(appData);
    refreshUI();
  }
};

// 3. Élèves
studentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const current = getActiveClass();
  const name = studentNameInput.value.trim();
  if (!name) return;

  const scores = {};
  const inputs = subjectScoresInputs.querySelectorAll('input');
  inputs.forEach(input => {
    const subj = input.getAttribute('data-subject');
    scores[subj] = parseFloat(input.value) || 10;
  });

  current.students.push({
    id: Date.now() + Math.random(),
    name,
    scores
  });

  saveAppData(appData);
  studentNameInput.value = '';
  inputs.forEach(i => i.value = '');
  studentNameInput.focus();
  renderStudents();
});

window.removeStudent = function(studentId) {
  const current = getActiveClass();
  current.students = current.students.filter(s => s.id !== studentId);
  // Nettoyer les contraintes liées
  for (const subj in current.exclusions) {
    current.exclusions[subj] = current.exclusions[subj].filter(
      e => e.personAId !== studentId && e.personBId !== studentId
    );
  }
  saveAppData(appData);
  renderStudents();
};

window.editStudentScore = function(studentId, subject) {
  const current = getActiveClass();
  const student = current.students.find(s => s.id === studentId);
  if (!student) return;

  const currentScore = student.scores[subject] ?? 10;
  const newScore = prompt(`Nouvelle note en ${subject} pour ${student.name} :`, currentScore);
  if (newScore !== null && !isNaN(parseFloat(newScore))) {
    student.scores[subject] = parseFloat(newScore);
    saveAppData(appData);
    renderStudents();
  }
};

function renderStudents() {
  const current = getActiveClass();
  studentsList.innerHTML = '';
  totalStudentsSpan.textContent = current.students.length;

  if (current.students.length === 0) {
    studentsList.innerHTML = '<li style="color: var(--text-muted); justify-content: center;">Aucun élève dans cette classe.</li>';
    return;
  }

  current.students.forEach(st => {
    const li = document.createElement('li');
    li.style.flexDirection = 'column';
    li.style.alignItems = 'stretch';
    li.style.gap = '0.5rem';

    const scoreBadges = current.subjects.map(subj => {
      const val = st.scores[subj] !== undefined ? st.scores[subj] : '-';
      let levelClass = '';
      let levelHint = '';
      if (typeof val === 'number') {
        const level = getSubjectLevel(val, subj, current);
        if (level === 'strong') {
          levelClass = ' score-strong';
          levelHint = ' ★';
        } else if (level === 'weak') {
          levelClass = ' score-weak';
          levelHint = ' ▽';
        }
      }
      return `<span class="score-badge${levelClass}" title="Cliquez pour modifier" onclick="editStudentScore(${st.id}, '${subj}')">${subj}: <strong>${val}</strong>${levelHint}</span>`;
    }).join(' ');

    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>${st.name}</strong>
        <button class="btn-remove" onclick="removeStudent(${st.id})">✕ Supprimer</button>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">Notes (cliquez pour éditer) :</span>
        ${scoreBadges}
      </div>
    `;
    studentsList.appendChild(li);
  });
}

function refreshUI() {
  renderClassesSelect();
  renderSubjects();
  renderStudents();
}

refreshUI();


// --- SAUVEGARDE & RESTAURATION INTÉGRALE (CLASSES + ÉLÈVES + NOTES + EXCLUSIONS) ---

const btnExportBackup = document.getElementById('btn-export-backup');
const backupFileInput = document.getElementById('backup-file-input');

// 1. Exporter l'intégralité de l'application en un seul fichier
btnExportBackup.addEventListener('click', () => {
  // Récupère l'état complet actuel
  const fullData = getAppData();

  if (!fullData || !fullData.classes || fullData.classes.length === 0) {
    alert("Aucune donnée à sauvegarder.");
    return;
  }

  // Convertit tout l'objet en texte formaté
  const dataString = JSON.stringify(fullData, null, 2);
  const blob = new Blob([dataString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Génération du nom de fichier avec la date du jour (ex: backup_classes_2026-11-07.json)
  const today = new Date().toISOString().split('T')[0];
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `sauvegarde_globale_${today}.json`;
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
});

// 2. Restaurer l'intégralité de la base dans le localStorage
backupFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const parsedData = JSON.parse(event.target.result);

      // Vérification minimale de validité
      if (!parsedData.classes || !Array.isArray(parsedData.classes)) {
        throw new Error("Format de fichier non reconnu.");
      }

      if (!confirm("Attention : Restaurer cette sauvegarde va remplacer toutes les classes et élèves actuels. Continuer ?")) {
        backupFileInput.value = '';
        return;
      }

      // Remplacement complet dans la mémoire locale
      appData = parsedData;
      saveAppData(appData);

      // Rechargement immédiat de l'interface
      refreshUI();
      alert(`Restauration terminée : ${appData.classes.length} classe(s) restaurée(s) avec succès !`);
    } catch (err) {
      alert("Erreur lors de la lecture du fichier : assurez-vous qu'il s'agit bien d'une sauvegarde valide.");
      console.error(err);
    } finally {
      backupFileInput.value = '';
    }
  };

  reader.readAsText(file, 'utf-8');
});