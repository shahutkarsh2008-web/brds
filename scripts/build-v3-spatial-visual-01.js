import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const v3Base = join(rootDir, 'client-v3', 'public', 'content', 'uceed-v3.0.0');
const srcFixturePath = join(rootDir, 'fixtures', 'spatial-visual-test-01.json');
const fixtureBytes = readFileSync(srcFixturePath);
const exam = JSON.parse(fixtureBytes.toString('utf8'));

// 1. Copy media to v3 content media
const targetMediaDir = join(v3Base, 'media', 'spatial-visual-test-01');
if (!existsSync(targetMediaDir)) {
  mkdirSync(targetMediaDir, { recursive: true });
}

const publicMediaDir = join(rootDir, 'public', 'media', 'spatial-visual-test-01');
const mediaFiles = readdirSync(publicMediaDir);
const mediaRecords = [];

for (const f of mediaFiles) {
  const src = join(publicMediaDir, f);
  const dst = join(targetMediaDir, f);
  const bytes = readFileSync(src);
  writeFileSync(dst, bytes);
  const hash = sha256(bytes);
  const relPath = `media/spatial-visual-test-01/${f}`;
  const rec = {
    path: relPath,
    sha256: hash,
    size: bytes.length,
    contentType: 'image/png'
  };
  mediaRecords.push(rec);
}
console.log(`Copied ${mediaRecords.length} media files to ${targetMediaDir}`);

// 2. Build paper JSON
const paperJson = {
  examKey: exam.id,
  title: exam.title,
  questionIds: exam.questions.map(q => q.id),
  partBQuestionIds: [],
  paperType: 'practice',
  durationMinutes: Math.round(exam.durationSeconds / 60),
  durationSeconds: exam.durationSeconds,
  totalQuestions: exam.questions.length,
  sourceFile: 'spatial-visual-test-01.json',
  sourceSha256: sha256(fixtureBytes),
  sourceQuestionCount: exam.questions.length,
  sourcePartBPromptCount: 0,
  sourceRecord: {
    id: exam.id,
    title: exam.title,
    durationSeconds: exam.durationSeconds,
    totalQuestions: exam.totalQuestions,
    maxMarks: exam.maxMarks,
    instructions: exam.instructions,
    sections: exam.sections
  }
};

const paperBytes = Buffer.from(JSON.stringify(paperJson));
writeFileSync(join(v3Base, 'papers', 'spatial-visual-test-01.json'), paperBytes);
console.log('Created papers/spatial-visual-test-01.json');

// 3. Build questions JSON
const topicMappings = {
  'Surface Area & Cube Counting': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T08',
    subskillIds: ['A-VSR-S017', 'A-VSR-S011'],
    patternIds: ['P-SPAT-STACK']
  },
  'Cube Nets & Face Relations': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T04',
    subskillIds: ['A-VSR-S009'],
    patternIds: ['P-SPAT-NET']
  },
  'Reflection & Rotation': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T02',
    subskillIds: ['A-VSR-S003'],
    patternIds: ['P-SPAT-ROTATE']
  },
  'Symmetry': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T02',
    subskillIds: ['A-VSR-S005'],
    patternIds: ['P-SPAT-SYMM']
  },
  'Orthographic Views & 3D Projections': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T05',
    subskillIds: ['A-VSR-S012'],
    patternIds: ['P-SPAT-VIEW']
  },
  'Hidden Figures': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T03',
    subskillIds: ['A-VSR-S007'],
    patternIds: ['P-SPAT-HIDDEN']
  },
  'Paper Folding & Punching': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T04',
    subskillIds: ['A-VSR-S008'],
    patternIds: ['P-SPAT-PUNCH', 'P-SPAT-FOLD']
  },
  'Viewpoint / Camera Rotation': {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T05',
    subskillIds: ['A-VSR-S013'],
    patternIds: ['P-SPAT-VPOINT']
  }
};

const questionsList = exam.questions.map((q, idx) => {
  const tMap = topicMappings[q.topic] || {
    domainId: 'A-VSR',
    topicId: 'A-VSR-T01',
    subskillIds: ['A-VSR-S001'],
    patternIds: ['P-SPAT-ROTATE']
  };

  const imgBasename = basename(q.image);
  const mediaRef = [{
    src: `/content/uceed-v3.0.0/media/spatial-visual-test-01/${imgBasename}`,
    alt: q.imageAlt || `Spatial and Visual Test 01 Question ${idx + 1} Diagram`
  }];

  return {
    id: q.id,
    examKeys: [exam.id],
    sourceType: 'practice',
    practiceCategory: 'design',
    domainId: tMap.domainId,
    topicId: tMap.topicId,
    subskillIds: tMap.subskillIds,
    patternIds: tMap.patternIds,
    traps: [],
    questionType: q.type,
    statement: q.prompt,
    options: q.options || [],
    answerSpec: q.answer,
    scoringSource: 'fixture',
    media: mediaRef,
    abilities: [],
    active: true,
    contentVersion: 'uceed-v3.0.0',
    taxonomyVersion: '3.0.0',
    mappingStatus: 'mapped',
    mappingConfidence: 'supported',
    legacyCategory: q.category,
    legacyTopic: q.topic,
    sourceCategory: q.category,
    sourceTopic: q.topic,
    marks: q.marks,
    sectionId: q.sectionId,
    taxonomyMapping: {
      taxonomyVersion: '3.0.0',
      status: 'mapped',
      domainId: tMap.domainId,
      topicId: tMap.topicId,
      subskillIds: tMap.subskillIds,
      patternIds: tMap.patternIds,
      rationale: `Direct mapping for ${q.topic}`
    },
    sourceIdentity: {
      sourceFile: 'spatial-visual-test-01.json',
      paperId: exam.id,
      collection: 'questions',
      order: idx + 1,
      originalQuestionId: q.id,
      sectionId: q.sectionId
    },
    sourceRecord: q
  };
});

const questionsBytes = Buffer.from(JSON.stringify(questionsList));
writeFileSync(join(v3Base, 'questions', 'spatial-visual-test-01.json'), questionsBytes);
console.log('Created questions/spatial-visual-test-01.json');

// 4. Update manifest.json
const manifestPath = join(v3Base, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Filter out existing if any
manifest.questionShards = manifest.questionShards.filter(s => s.examKey !== exam.id);
manifest.papers = manifest.papers.filter(p => p.examKey !== exam.id);

manifest.questionShards.push({
  examKey: exam.id,
  path: 'questions/spatial-visual-test-01.json',
  sha256: sha256(questionsBytes),
  count: questionsList.length
});

manifest.papers.push({
  examKey: exam.id,
  path: 'papers/spatial-visual-test-01.json',
  sha256: sha256(paperBytes)
});

// Add media records avoiding duplicates
const existingMediaPaths = new Set(manifest.media.map(m => m.path));
for (const rec of mediaRecords) {
  if (!existingMediaPaths.has(rec.path)) {
    manifest.media.push(rec);
    existingMediaPaths.add(rec.path);
  } else {
    // update sha256/size if changed
    const existing = manifest.media.find(m => m.path === rec.path);
    if (existing) {
      existing.sha256 = rec.sha256;
      existing.size = rec.size;
    }
  }
}

manifest.generatedAt = new Date().toISOString();

writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
console.log(`Updated manifest.json: now has ${manifest.papers.length} papers and ${manifest.media.length} media references`);
