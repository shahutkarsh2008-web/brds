import { randomUUID } from 'node:crypto';
import { HttpError } from './auth.js';

const DEFAULT_PREFERENCES = { targetExam: 'UCEED 2026', theme: 'dark', reminders: false };

// A deliberately small starter deck. The UI labels its size and never presents
// these sample cards as a complete GK syllabus or as measured retention data.
const GK_CARDS = [
  { id: 'gk-harappan-seals', category: 'Indian Art & Heritage', front: 'Which ancient civilisation is especially known for steatite seals featuring animal motifs and inscriptions?', back: 'The Indus Valley (Harappan) civilisation. Many seals are associated with sites such as Harappa and Mohenjo-daro.' },
  { id: 'gk-sanchi-stupa', category: 'Indian Art & Heritage', front: 'At which site is the Great Stupa commissioned by Ashoka located?', back: 'Sanchi, in present-day Madhya Pradesh. Its gateways (toranas) are celebrated examples of early Buddhist narrative sculpture.' },
  { id: 'gk-ajanta', category: 'Indian Art & Heritage', front: 'The Ajanta caves are best known for which art forms?', back: 'Buddhist rock-cut architecture, sculpture and murals, including paintings that narrate Jataka stories.' },
  { id: 'gk-madhubani', category: 'Indian Art & Heritage', front: 'Madhubani painting is traditionally associated with which region?', back: 'The Mithila region of Bihar. Traditional themes include nature, ritual and epic narratives.' },
  { id: 'gk-blue-pottery', category: 'Craft & Materials', front: 'Which Indian craft is widely associated with Jaipur and a blue, often lead-glazed surface?', back: 'Jaipur blue pottery. It is a quartz-based ceramic tradition rather than ordinary clay pottery.' },
  { id: 'gk-channapatna', category: 'Craft & Materials', front: 'Channapatna is known for what kind of craft?', back: 'Lacquered wooden toys and objects, traditionally made in Karnataka.' },
  { id: 'gk-kantha', category: 'Craft & Materials', front: 'What is distinctive about traditional Kantha embroidery?', back: 'Running stitches are used to quilt layers of old cloth and create decorative motifs, a tradition associated with Bengal.' },
  { id: 'gk-worli', category: 'Visual Culture', front: 'What visual qualities are commonly associated with Warli painting?', back: 'Monochrome figures built from simple geometric forms, especially circles, triangles and lines, traditionally painted by Warli communities in Maharashtra.' },
  { id: 'gk-kalamkari', category: 'Craft & Materials', front: 'What does the word Kalamkari refer to?', back: 'A tradition of hand-painted or block-printed cotton textiles, especially associated with Andhra Pradesh and Telangana.' },
  { id: 'gk-terracotta', category: 'Materials & Making', front: 'What is terracotta?', back: 'Fired, usually unglazed clay. Its colour commonly comes from iron compounds in the clay body.' },
  { id: 'gk-bauhaus', category: 'Design History', front: 'What was the Bauhaus?', back: 'A German school of art, design and architecture founded by Walter Gropius in 1919, known for connecting craft, art and industrial production.' },
  { id: 'gk-indus-script', category: 'Indian Art & Heritage', front: 'Has the Indus script been conclusively deciphered?', back: 'No. Its signs remain undeciphered, so proposed readings are not established consensus.' }
];

const GUIDES = [
  { id: 'visual-observation', title: 'Visual observation', topic: 'Observation & Visualisation', summary: 'Separate what is directly visible from what you infer. Track orientation, overlap, negative space and repeated details before choosing an answer.', workedExample: 'For a rotated object, mark one asymmetric feature first. Rotate that feature mentally with the object; do not mirror it unless the question shows a reflection.', quiz: [
    { id: 'vo1', prompt: 'A clockwise rotation changes an object’s orientation but preserves its…', options: ['left-right order of its own features', 'mirror image', 'number of visible faces in every view'], answer: 0 },
    { id: 'vo2', prompt: 'Which is the safest first step in a visual comparison?', options: ['Notice a distinctive landmark', 'Guess from the silhouette only', 'Ignore overlap'], answer: 0 },
    { id: 'vo3', prompt: 'A reflection differs from a rotation because it…', options: ['reverses handedness', 'always changes size', 'adds a face'], answer: 0 },
    { id: 'vo4', prompt: 'Negative space means…', options: ['the space around or between forms', 'a dark colour only', 'an incorrect answer'], answer: 0 },
    { id: 'vo5', prompt: 'For a sequence, a useful check is…', options: ['which visual property changes at each step', 'only the colours', 'the longest option'], answer: 0 }
  ] },
  { id: 'spatial-reasoning', title: 'Spatial reasoning', topic: 'Spatial Ability', summary: 'Represent folds, cuts and rotations as ordered operations. Keep a fixed reference edge and check symmetry only where the operation creates it.', workedExample: 'After folding a sheet twice, a hole away from a fold line appears once in each reflected position when the sheet is opened. Count each fold reflection in reverse order.', quiz: [
    { id: 'sr1', prompt: 'When unfolding a paper cut, reverse the folds in…', options: ['reverse order', 'random order', 'colour order'], answer: 0 },
    { id: 'sr2', prompt: 'A cube net is valid when…', options: ['six squares fold to six distinct faces without overlap', 'all squares share one edge', 'it contains a triangle'], answer: 0 },
    { id: 'sr3', prompt: 'A 90° clockwise rotation maps the top edge toward the…', options: ['right side', 'left side', 'bottom only'], answer: 0 },
    { id: 'sr4', prompt: 'A mirror reflection preserves…', options: ['distances and angles', 'handedness', 'left-right order'], answer: 0 },
    { id: 'sr5', prompt: 'For a cube view comparison, track…', options: ['which faces meet at a shared corner', 'only the background', 'the printed font'], answer: 0 }
  ] },
  { id: 'design-thinking', title: 'Design thinking', topic: 'Design Sensitivity', summary: 'Frame the user and context, identify constraints, then compare alternatives by usefulness, clarity, feasibility and inclusion.', workedExample: 'For a public wayfinding sign, first ask who needs it and from what distance. Prioritise readable contrast, concise wording and consistent placement before decoration.', quiz: [
    { id: 'dt1', prompt: 'A useful design brief begins with…', options: ['users, needs and context', 'a favourite colour', 'a final logo'], answer: 0 },
    { id: 'dt2', prompt: 'Which is an accessibility consideration?', options: ['legible contrast and multiple cues', 'small low-contrast text', 'colour as the only signal'], answer: 0 },
    { id: 'dt3', prompt: 'A prototype is primarily used to…', options: ['test an idea and learn', 'prove an idea is perfect', 'replace user research'], answer: 0 },
    { id: 'dt4', prompt: 'A constraint is…', options: ['a limit that shapes the solution', 'a decoration', 'an answer key'], answer: 0 },
    { id: 'dt5', prompt: 'When comparing concepts, prefer evidence about…', options: ['how well they meet the brief', 'which is most ornate', 'which took longest'], answer: 0 }
  ] },
  { id: 'colour-and-composition', title: 'Colour & composition', topic: 'Design Sensitivity', summary: 'Read hierarchy through scale, contrast, alignment, repetition and proximity. Check how foreground and background interact.', workedExample: 'If every item competes for attention, reduce competing contrast and give the primary action stronger size or position. Keep text contrast sufficient.', quiz: [
    { id: 'cc1', prompt: 'Visual hierarchy helps a viewer…', options: ['find the most important information first', 'read every item at once', 'ignore grouping'], answer: 0 },
    { id: 'cc2', prompt: 'Elements placed near one another are often perceived as…', options: ['a group', 'opposites', 'larger'], answer: 0 },
    { id: 'cc3', prompt: 'Contrast can distinguish…', options: ['foreground from background', 'a circle from its centre only', 'time from distance'], answer: 0 },
    { id: 'cc4', prompt: 'A repeated alignment usually improves…', options: ['order and scanning', 'randomness', 'resolution'], answer: 0 },
    { id: 'cc5', prompt: 'A complementary colour pair is positioned…', options: ['opposite on a colour wheel', 'next to itself', 'only in grayscale'], answer: 0 }
  ] }
];

const optionShift = question => Number(question.id.match(/(\d+)$/)?.[1] || 0) % question.options.length;
const publicQuiz = guide => ({ ...guide, quiz: guide.quiz.map(({ answer, ...question }) => {
  const shift = optionShift({ ...question, answer });
  return { ...question, options: [...question.options.slice(shift), ...question.options.slice(0, shift)] };
}) });

export function createStudentFeatures(database, { now = Date.now } = {}) {
  return {
    async getPreferences(userId) {
      const { rows = [] } = await database.query('SELECT preferences_json FROM student_preferences WHERE user_id=$1', [userId]);
      return { ...DEFAULT_PREFERENCES, ...(rows[0] ? JSON.parse(rows[0].preferences_json) : {}) };
    },
    async savePreferences(userId, input) {
      const allowed = ['targetExam', 'theme', 'reminders'];
      if (!input || Object.keys(input).some(key => !allowed.includes(key)) || !Object.keys(input).length) throw new HttpError(400, 'Choose a supported preference to update.');
      const changes = {};
      if (Object.hasOwn(input, 'targetExam')) {
        if (typeof input.targetExam !== 'string' || !input.targetExam.trim() || input.targetExam.trim().length > 60) throw new HttpError(400, 'Target exam must be 1–60 characters.');
        changes.targetExam = input.targetExam.trim();
      }
      if (Object.hasOwn(input, 'theme')) {
        if (!['dark', 'light'].includes(input.theme)) throw new HttpError(400, 'Theme must be dark or light.');
        changes.theme = input.theme;
      }
      if (Object.hasOwn(input, 'reminders')) {
        if (typeof input.reminders !== 'boolean') throw new HttpError(400, 'Reminders must be enabled or disabled.');
        changes.reminders = input.reminders;
      }
      return database.transaction(async query => {
        await query('INSERT INTO student_preferences(user_id,preferences_json,updated_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING', [userId, JSON.stringify(DEFAULT_PREFERENCES), now()]);
        const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
        const { rows = [] } = await query(`SELECT preferences_json FROM student_preferences WHERE user_id=$1${lock}`, [userId]);
        const next = { ...DEFAULT_PREFERENCES, ...(rows[0] ? JSON.parse(rows[0].preferences_json) : {}), ...changes };
        await query('UPDATE student_preferences SET preferences_json=$1,updated_at=$2 WHERE user_id=$3', [JSON.stringify(next), now(), userId]);
        return next;
      });
    },
    async getGkCards(userId) {
      const { rows = [] } = await database.query('SELECT card_id,box,seen_count,last_reviewed_at FROM gk_card_progress WHERE user_id=$1', [userId]);
      const progress = new Map(rows.map(row => [row.card_id, row]));
      const cards = GK_CARDS.map(card => ({ ...card, box: Number(progress.get(card.id)?.box || 0), seenCount: Number(progress.get(card.id)?.seen_count || 0), lastReviewedAt: progress.get(card.id) ? Number(progress.get(card.id).last_reviewed_at) : null }));
      return { cards, totalCards: cards.length, dueCount: cards.filter(card => card.box < 5).length };
    },
    async reviewGkCard(userId, cardId, rating) {
      if (!GK_CARDS.some(card => card.id === cardId)) throw new HttpError(404, 'Flashcard not found.');
      if (!['again', 'remembered'].includes(rating)) throw new HttpError(400, 'Choose again or remembered.');
      return database.transaction(async query => {
        const reviewedAt = now();
        const initialBox = rating === 'remembered' ? 1 : 0;
        await query(`INSERT INTO gk_card_progress(user_id,card_id,box,seen_count,last_reviewed_at) VALUES($1,$2,$3,1,$4)
          ON CONFLICT(user_id,card_id) DO UPDATE SET
            box=CASE WHEN $5='again' THEN 0 WHEN gk_card_progress.box<5 THEN gk_card_progress.box+1 ELSE 5 END,
            seen_count=gk_card_progress.seen_count+1,last_reviewed_at=excluded.last_reviewed_at`, [userId, cardId, initialBox, reviewedAt, rating]);
        const { rows = [] } = await query('SELECT box,seen_count FROM gk_card_progress WHERE user_id=$1 AND card_id=$2', [userId, cardId]);
        return { cardId, box: Number(rows[0].box), seenCount: Number(rows[0].seen_count), lastReviewedAt: reviewedAt };
      });
    },
    async listSketches(userId) {
      const { rows = [] } = await database.query('SELECT id,title,prompt,image_data_url,created_at FROM student_sketches WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [userId]);
      return { sketches: rows.map(row => ({ id: row.id, title: row.title, prompt: row.prompt, imageDataUrl: row.image_data_url, createdAt: Number(row.created_at) })) };
    },
    async createSketch(userId, input) {
      if (typeof input?.title !== 'string' || !input.title.trim() || input.title.trim().length > 100) throw new HttpError(400, 'Sketch title must be 1–100 characters.');
      if (typeof input?.prompt !== 'string' || !input.prompt.trim() || input.prompt.trim().length > 500) throw new HttpError(400, 'Add a prompt of up to 500 characters.');
      const match = typeof input.imageDataUrl === 'string' && input.imageDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) throw new HttpError(400, 'Upload a PNG, JPEG or WebP image.');
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== match[2]) throw new HttpError(413, 'Sketch image must be a valid image under 2 MB.');
      const signatureOk = match[1] === 'png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match[1] === 'jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217
          : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!signatureOk) throw new HttpError(400, 'The uploaded file does not match its image type.');
      const id = randomUUID();
      const createdAt = now();
      await database.transaction(async query => {
        const count = Number((await query('SELECT COUNT(*) AS count FROM student_sketches WHERE user_id=$1', [userId])).rows?.[0]?.count || 0);
        if (count >= 20) throw new HttpError(409, 'Your gallery is full (20 sketches). Delete one before adding another.');
        await query('INSERT INTO student_sketches(id,user_id,title,prompt,image_data_url,created_at) VALUES($1,$2,$3,$4,$5,$6)', [id, userId, input.title.trim(), input.prompt.trim(), input.imageDataUrl, createdAt]);
      });
      return { id, title: input.title.trim(), prompt: input.prompt.trim(), imageDataUrl: input.imageDataUrl, createdAt };
    },
    async deleteSketch(userId, id) {
      const result = await database.query('DELETE FROM student_sketches WHERE id=$1 AND user_id=$2', [id, userId]);
      return result.rowCount > 0;
    },
    listGuides() { return { guides: GUIDES.map(publicQuiz) }; },
    async guideProgress(userId) {
      const { rows = [] } = await database.query('SELECT guide_id,correct,total,submitted_at FROM guide_quiz_attempts WHERE user_id=$1 ORDER BY submitted_at DESC', [userId]);
      const progress = new Map();
      for (const row of rows) {
        const item = progress.get(row.guide_id) || { guideId: row.guide_id, attempts: 0, lastCorrect: Number(row.correct), lastTotal: Number(row.total), lastSubmittedAt: Number(row.submitted_at) };
        item.attempts += 1;
        progress.set(row.guide_id, item);
      }
      return { progress: [...progress.values()] };
    },
    async reviewedRevisionKeys(userId) {
      const { rows = [] } = await database.query('SELECT exam_id,question_id,reviewed_at FROM student_revision_reviews WHERE user_id=$1', [userId]);
      return new Map(rows.map(row => [`${row.exam_id}:${row.question_id}`, Number(row.reviewed_at)]));
    },
    async setRevisionReviewed(userId, examId, questionId, reviewed) {
      if (reviewed) await database.query('INSERT INTO student_revision_reviews(user_id,exam_id,question_id,reviewed_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,exam_id,question_id) DO UPDATE SET reviewed_at=excluded.reviewed_at', [userId, examId, questionId, now()]);
      else await database.query('DELETE FROM student_revision_reviews WHERE user_id=$1 AND exam_id=$2 AND question_id=$3', [userId, examId, questionId]);
      return { examId, questionId, reviewed: Boolean(reviewed) };
    },
    async submitGuideQuiz(userId, guideId, answers) {
      const guide = GUIDES.find(item => item.id === guideId);
      if (!guide) throw new HttpError(404, 'Guide quiz not found.');
      if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).some(id => !guide.quiz.some(question => question.id === id)) || guide.quiz.some(question => !Number.isInteger(answers[question.id]) || answers[question.id] < 0 || answers[question.id] >= question.options.length)) throw new HttpError(400, 'Answer all quiz questions using a valid option.');
      const correct = guide.quiz.reduce((sum, question) => sum + (answers[question.id] === (question.answer - optionShift(question) + question.options.length) % question.options.length ? 1 : 0), 0);
      const submittedAt = now();
      const id = randomUUID();
      await database.query('INSERT INTO guide_quiz_attempts(id,user_id,guide_id,correct,total,submitted_at) VALUES($1,$2,$3,$4,$5,$6)', [id, userId, guideId, correct, guide.quiz.length, submittedAt]);
      return { id, guideId, correct, total: guide.quiz.length, percentage: Math.round(correct / guide.quiz.length * 100), submittedAt };
    }
  };
}
