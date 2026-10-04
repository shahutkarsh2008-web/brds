import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const reviewed = JSON.parse(readFileSync(new URL('./question-topic-map.json', import.meta.url), 'utf8'));
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const topicDefinitions = {
  count: ['Pattern Counting', 'Observation & Design Sensitivity', 'Visual observation and attention to detail'],
  difference: ['Spot the difference', 'Observation & Design Sensitivity', 'Visual Acuity'],
  odd: ['Odd-one-out', 'Observation & Design Sensitivity', 'Classification and grouping'],
  font: ['Typography & Fonts', 'Language & Creativity', 'Font & Logo Identification'],
  logo: ['Logo Identification', 'Observation & Design Sensitivity', 'Font & Logo Identification'],
  pattern: ['Texture & Pattern Matching', 'Observation & Design Sensitivity', 'Spatial patterns and sequences'],
  sequence: ['Pattern Sequences', 'Analytical & Logical Reasoning', 'Number patterns and sequences', 'Pattern-based creative reasoning'],
  assemble: ['Spatial Assembly', 'Visualization & Spatial Reasoning', '2D and 3D visualization', 'Figure completion'],
  solid: ['2D and 3D visualization', 'Visualization & Spatial Reasoning', 'Spatial Assembly', '2D → 3D Visualization'],
  faces: ['Faces, edges and vertices', 'Visualization & Spatial Reasoning', 'Spatial Assembly'],
  slice: ['Cross-sections and slicing', 'Visualization & Spatial Reasoning', 'Spatial Assembly'],
  rotate: ['Rotation and reflection', 'Visualization & Spatial Reasoning', '3D Isometric Rotations', 'Rotation', 'Reflection'],
  mirror: ['Mirror images and water images', 'Visualization & Spatial Reasoning', 'Mirror / Water Images'],
  symmetry: ['Symmetry — reflection and rotational', 'Visualization & Spatial Reasoning', 'Symmetry'],
  fold: ['Paper folding, cutting and punching', 'Visualization & Spatial Reasoning', 'Paper Folding & Unfolding'],
  net: ['Cube and cuboid nets', 'Visualization & Spatial Reasoning', 'Surface Development', 'Folding and unfolding 3D objects'],
  views: ['Top, front and side views', 'Visualization & Spatial Reasoning', 'Orthographic Projections', 'Top / Front / Side Views'],
  perspective: ['Perspective and depth', 'Visualization & Spatial Reasoning', 'Viewpoint and orientation', 'Perspective & Grid Drawing'],
  blocks: ['Block arrangement and stacking', 'Visualization & Spatial Reasoning', 'Spatial Assembly'],
  paths: ['Paths, grids and mazes', 'Visualization & Spatial Reasoning', 'Spatial Puzzles', 'Paths and networks'],
  geometry: ['Area, perimeter, volume and surface area', 'Analytical & Logical Reasoning', 'Geometry (Angles, Triangles, Quadrilaterals, Circles, Polygons)', 'Ratio & Proportion'],
  arithmetic: ['Arithmetic', 'Analytical & Logical Reasoning', 'Ratio & Proportion', 'Ratios and proportions', 'Basic algebra and equations'],
  probability: ['Counting and arrangements', 'Analytical & Logical Reasoning', 'Probability basics'],
  logic: ['Logical conditions and statements', 'Analytical & Logical Reasoning', 'Spatial Puzzles', 'Matching and assignment', 'Ranking and ordering'],
  sets: ['Sets and grouping', 'Analytical & Logical Reasoning', 'Venn Diagrams'],
  data: ['Tables, charts and graphs', 'Analytical & Logical Reasoning'],
  code: ['Pattern decoding', 'Analytical & Logical Reasoning', 'Symbol-based arithmetic'],
  speed: ['Distance and speed', 'Analytical & Logical Reasoning', 'Time and clocks'],
  mechanism: ['Everyday objects and mechanisms', 'Practical & Scientific Knowledge', 'Mechanical Reasoning', 'Simple machines (Lever, pulley, wheel-and-axle, inclined plane, screw, wedge)', 'Tools and their practical use', 'Joints, hinges, folds, handles and fasteners'],
  balance: ['Balance and stability', 'Practical & Scientific Knowledge', 'Mechanical Reasoning', 'Centre of mass — basic intuition'],
  light: ['Light, reflection and refraction', 'Practical & Scientific Knowledge', 'Shadow & Light Analysis', 'Shadows', 'Shadow direction'],
  material: ['Materials and their properties (Wood, metal, glass, plastic, paper, rubber, fabric)', 'Practical & Scientific Knowledge', 'Heat and thermal expansion'],
  usability: ['Usability', 'Observation & Design Sensitivity', 'Human-object interaction', 'Function from form', 'Ergonomics (Reach, grip, access and comfort)', 'Design Icons & Products'],
  nature: ['Natural environment and geography', 'Environment & Society', 'Environmental Awareness'],
  culture: ['Traditional crafts and objects', 'Environment & Society', 'Indian Art & Craft Culture', 'Social behaviour and cultural context', 'Architectural History'],
  symbols: ['Signs and symbols & symbol interpretation', 'Creativity', 'Visual communication'],
  language: ['Reading comprehension', 'Language', 'Sentence interpretation', 'Vocabulary in context'],
  analogy: ['Visual analogies', 'Creativity', 'Idiom Visualization', 'Metaphors & visual metaphors'],
  animation: ['Sequence of operation', 'Observation & Design Sensitivity', 'Storyboard Sequence', 'Prediction from visual information'],
  colour: ['Colour and composition', 'Observation & Design Sensitivity', 'Poster & Branding Concepts'],
  anatomy: ['Human Anatomy & Proportion', 'Observation & Design Sensitivity'],
  review: ['Uncategorised — needs review', 'Needs review']
};

export function questionFingerprint(question) {
  return createHash('sha256').update(JSON.stringify([normalize(question.prompt), question.image || '', question.type])).digest('hex');
}
const byFingerprint = new Map(Object.values(reviewed).flatMap(entries => Object.values(entries)).filter(x => x.code !== 'review').map(x => [x.fingerprint, x]));
const metadataCode = value => Object.keys(topicDefinitions).find(code => normalize(topicDefinitions[code][0]) === normalize(value))
  || Object.keys(topicDefinitions).find(code => topicDefinitions[code].slice(2).some(label => normalize(label) === normalize(value)));
const generic = value => !value || /^(section\b|design aptitude\s*&|nat$|mcq$|msq$|uncategorised)/i.test(value);

export function classifyQuestion(exam, question) {
  const fingerprint = questionFingerprint(question);
  const entry = reviewed[exam.id]?.[question.id];
  const mapped = entry?.fingerprint === fingerprint ? entry : byFingerprint.get(fingerprint);
  let code = mapped?.code;
  let source = mapped ? 'reviewed-content' : 'metadata';
  const section = exam.sections?.find(item => item.id === question.sectionId);
  if (!code) code = metadataCode(question.topic) || metadataCode(section?.title);
  if (!code && !generic(question.topic)) return { ...question, classification: 'provided' };
  // Future papers enter the shared bank immediately. Infer only explicit concepts;
  // do not pretend an image-only prompt has been inspected.
  if (!code) {
    source = 'suggested-rule';
    const prompt = normalize(question.prompt);
    const rules = [
      ['net', /cube net|unfolded cube|unwrapped cube/], ['fold', /paper.*fold|paper.*punch|sheet.*unfold/],
      ['mirror', /mirror image|water image/], ['symmetry', /symmetr/], ['views', /top view|front view|side view/],
      ['faces', /(?:number of|how many) (surfaces|faces|vertices|edges)/], ['font', /\bfont/], ['logo', /\blogo\b/],
      ['mechanism', /\b(gears?|pulley|lever|hinge|fulcrum)\b/], ['light', /refraction|shadow|light source/],
      ['geometry', /\b(area|perimeter|volume|circumference)\b/], ['sets', /venn diagram/],
      ['rotate', /rotat|reflect/], ['probability', /probability/]
    ];
    code = rules.find(([, pattern]) => pattern.test(prompt))?.[0] || 'review';
  }
  const [topic, category] = topicDefinitions[code];
  return { ...question, topic, category, classification: code === 'review' ? 'needs-review' : source };
}

export function categoriseExam(exam) {
  return { ...exam, questions: (exam.questions || []).map(question => classifyQuestion(exam, question)) };
}

export function matchesTopic(question, requested) {
  const target = normalize(requested);
  const values = [question.topic, question.category, ...(Array.isArray(question.tags) ? question.tags : [])];
  const code = metadataCode(question.topic);
  if (code) values.push(...topicDefinitions[code]);
  return values.some(value => normalize(value) === target);
}
