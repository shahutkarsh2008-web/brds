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
  economy: ['Economy & Society', 'Environment & Society', 'Economic policy, consumer behaviour and social issues'],
  gestalt: ['Gestalt Principles of Perception', 'Observation & Design Sensitivity', 'Perceptual grouping and visual closure'],
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
      // Read the stem for its concept before falling back to image-only review.
      ['language', /spelling mistakes|punctuation|anagram|idiom|oxymoron|vocabulary|word meaning|complete the following .*sentences|sentence(s)? .*word|read the (following )?(passage|poem|paragraph|text)|which words|terms relate to printmaking|rasa in|metaphor|which of the following words|words are similar|similar in meaning|related to the phrase|easy to understand|complete the .* sentence|fill in the blanks/],
      ['nature', /green revolution|greenhouse gas|carbon dioxide|carbon footprint|climate scientist|el nino|environment(al)?|natural resources|sustainable development|species|wildlife|animal or plant|national parks|river(s)?\b|ramsar convention|vienna convention|montreal protocol|rock formation|deficiency of proteins|which of the following crawl|leaf of the plant|flower .* leaf|pregnancy|childbirth|maharashtra =/],
      ['economy', /econom(y|ic)|consumer spending|currency|devaluation|trade deficit|barter system|exchange .* (toffee|sweet|lollypop)|economic policy|employment|public spending|parking spaces|nomadic tribes|complicated pregnancies|what profession could be attributed|discount(s)? .* (series|purchase)|discount for a purchase/],
      ['culture', /indus valley|silk route|leonardo da vinci|paul klee|anjali ila menon|raja ravi varma|ajanta|islamic architecture|rock cut architecture|traditional embroidery|dance forms|art movement|famous painting|vikram and vetala|cultural|histor(y|ical)|artist(s)?|painting(s)? by|designed by raymond loewy|films shown|cartoonist|gandhara|picasso|avatar(s)?|traditional product|art technique|print roller|printmaking|fowler|escher|materials .* writing|used for writing in ancient|logo(s)?|stamp used for printing|hammering on strings|musical instruments/],
      ['usability', /ergonomic|comfortable hand posture|human.object interaction|design process|parking spaces|privacy of a space|door frame|product designed|camera body|dslr|interchangeability of products|audio experience|user experience|photographed using/],
      ['mechanism', /interlocking rods|hinged joint|rigid structure|folding chair|folding umbrella|umbrella|screws that allow|gear(s)?\b|pulley|lever|latch|scissors|cutting strength|handle position|hand tool|mechanical|force (is )?applied|spring back|tyre tread|tire tread|shoe sole|schematic diagrams? .*structure|folding partitions?/],
      ['light', /colour filter|color filter|photograph(s)? .*glare|avoid the glare|camera use to form an image|pinhole camera|image cast|refraction|convex lens|half.filled with water|straw .*water|shadow|light source|pigment colours?|pigment colors?|rgb mode|complementary colou?r|resultant colou?r/],
      ['speed', /hour and minute hands|clock.*(minutes|hours)|how many minutes will they meet|what will the angle be between.*hands|strange clock|matches time with the regular clock|time .* from now/],
      ['arithmetic', /calculator|largest number you can calculate|how many pages .* roll|length and breadth|four digit number|missing f.number|f\/__/],
      ['geometry', /quadrant of a disc|cut.outs in the complete disc|pass through all the cutouts|cross.section(s)?|holes .* drilled through|chord(s)? .* circle|revolved about the .* axis|solid shape .* generated|all one stroke|without .* lifting the pen|retracing any line/],
      ['gestalt', /gestalt|perceptual grouping|visual closure|escher .* concept|which concept does this image/],
      ['anatomy', /dignified insides|digestive|human body|farts|burps/],
      ['data', /population .* (chart|graph|pyramid)|pie chart|horizontal axis|vertical axis|distribution of population|survey .* concertgoers|percentage|percent of the population|statistics|most consistent performance|least variance|average .* team|operating profit ratio|discount .* series/],
      ['sets', /venn diagram|all .* some .* conclusions|all doctors|which of the following statements|statements .* conclusions|which statements .* true|select all statements|select .* statements .* true|which conclusion(s)? .* valid|four bins|thrown in their respective bins|classify .* objects|600 students|played both football|football, hockey and cricket/],
      ['logic', /how many different ways|without visiting .* more than once|handshake(s)?|how many .* (ways|arrangements)|exactly one other person|matching .* investigators|who .* is .* (pilot|teacher|accountant)|rules of contacting|route|directions are encoded|which order|arrange .* according to|most logical sequence|correct sequence of steps|steps .* mixed up|next in the pattern|replace the question mark|follows the logic|number sequence|series of numbers|matrix sequence|coded with symbols|code for figure|shakes hands|wards .* equal|fewest steps|which of the statement(s)?|which of the following statements|what can be derived|which conclusions?/],
      ['geometry', /parallelogram|triangle(s)?\b|circle|chord(s)?|angle between|area|perimeter|volume|cuboid|sphere(s)?\b|rectangle|square(s)?\b|polygon|four digit number|length .* breadth|surface area|maximum number .* fit|integer length|number of surfaces|painted .* cube|small cubes/],
      ['assemble', /put .* together|arranged correctly|assembled to form|assembled using|can be constructed|can be made using|made using all|pieces .* form|jigsaw|fit together|exactly fit|fit in the empty box|folded to make|folded .* object|unfolded view|opened up surfaces|folded back|merge(d)? .* form|merged objects|join(ed)? together to form|complete cube|missing block|replace the missing block|bisect .* shape|cut .* into pieces|cut into two parts|same object from a different view|different view|same block from the options/],
      ['views', /top view|front view|side view|views of the same|different view|different direction|view(s)? belong to the object|same object from a different view|sixth view of the cube|orthographic/],
      ['fold', /paper folding|paper.*fold|folding lines|folded along|folded over|folded to make|folded back|folded box|unfolded (view|cube|cuboid|box)|opened up surfaces/],
      ['blocks', /block arrangement|stacked .* (blocks|cubes|pieces)|number of cubes|number of cuboids|configurations of blocks|blocks .* packed|holes .* cube|blocks .* surface/],
      ['paths', /maze|reach .* tile|tile [a-z] to tile|route|path(s)?\b|walk(s|ing)? .* (left|right|west|east|north|south)|shortest distance|fewest steps/],
      ['pattern', /pattern|sequence of shapes|sequence|replace the question mark|missing (figure|block|shape)|which option comes next|completes? the series|complete the series|visual features|matrix with question marks|hatch sequence|dot(s)? .* logic|f.number|f\/__/],
      ['count', /count the number|count the total|how many (?!surfaces|faces|vertices|edges).* (appear|are there|can be seen|are shown)|how many (different )?types of|number of occurrences|number of .* in the (figure|image|picture)|spot the differences|number of differences|identify the odd one out|odd one out|different types of characters|part(s)? of that photograph|statement(s)? .* picture/],
      ['symbols', /different types of symbols|symbols used for different functions|correct description sequence|shapes .* correspond to different numbers|shapes .* associated with .* alphabets|alphabet(s)? for the last shape|counter.*letter|code for figure|http codes|server messages|proposed code/],
      ['animation', /animation sequence|frames? .* mixed up|correct order|sequence of drawings|film(s)? shown|interview .* planned|comic page|dialogues .* bubble|mouth shapes|visual sequence/],
      ['colour', /colour pattern|color pattern|choose the colour|choose the color|set of colours|set of colors|colour(s)? .* painting|color(s)? .* painting|colour composition|color composition|colour transformation|first colour transformation|goggles .* dusk|lighting conditions|photographs .* settings|avoid the glare/],
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
