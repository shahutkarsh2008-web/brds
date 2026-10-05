#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'fixtures');
const outputJson = path.join(root, 'reports/uceed-syllabus-subtopic-coverage.json');
const outputMarkdown = path.join(root, 'reports/uceed-syllabus-subtopic-coverage.md');

const areas = [
  {
    part: 'Part A', area: 'Visualization & Spatial Reasoning', subtopics: [
      '2D and 3D visualization', 'Spatial relationships', 'Rotation and reflection',
      'Mirror images and water images', 'Symmetry — reflection and rotational', 'Figure completion',
      'Embedded and hidden figures', 'Paper folding, cutting and punching', 'Cube and cuboid nets',
      'Folding and unfolding 3D objects', 'Faces, edges and vertices', 'Top, front and side views',
      'Viewpoint and orientation', 'Perspective and depth', 'Cross-sections and slicing',
      'Block arrangement and stacking', 'Paths, grids and mazes', 'Shadow direction',
      'Spatial patterns and sequences'
    ]
  },
  {
    part: 'Part A', area: 'Practical & Scientific Knowledge', subtopics: [
      'Everyday objects and mechanisms', 'Simple machines',
      'Lever, pulley, wheel-and-axle, inclined plane, screw and wedge',
      'Force, motion and gravity', 'Friction', 'Balance and stability',
      'Centre of mass — basic intuition', 'Light, reflection and refraction', 'Shadows',
      'Transparent, translucent and opaque materials', 'Sound — basic everyday applications',
      'Heat and thermal expansion', 'Materials and their properties',
      'Wood, metal, glass, plastic, paper, rubber and fabric', 'Tools and their practical use',
      'Joints, hinges, folds, handles and fasteners', 'Basic measurement, scale and estimation'
    ]
  },
  {
    part: 'Part A', area: 'Observation & Design Sensitivity', subtopics: [
      'Visual observation and attention to detail', 'Spot the difference', 'Classification and grouping',
      'Odd-one-out', 'Hidden or concealed properties', 'Function from form',
      'Incorrect or impossible construction', 'Sequence of operation', 'Visual inference',
      'Prediction from visual information', 'Human-object interaction', 'Usability', 'Ergonomics',
      'Reach, grip, access and comfort', 'Safety and stability', 'Product affordances',
      'Context-sensitive design', 'Comparing alternative designs'
    ]
  },
  {
    part: 'Part A', area: 'Environment & Society', subtopics: [
      'Environment-friendly design', 'Reduce, reuse and recycle', 'Repair and reuse',
      'Materials and environmental impact', 'Waste management and segregation', 'Water conservation',
      'Energy conservation', 'Accessibility and inclusive design', 'Design for children and elderly people',
      'Design for people with different abilities', 'Public spaces', 'Community needs',
      'Transportation and mobility', 'Urban and rural contexts', 'Social behaviour and cultural context',
      'Traditional crafts and objects', 'Symbols and cultural practices',
      'Sustainable and climate-responsive design', 'Human impact on environment'
    ]
  },
  {
    part: 'Part A', area: 'Analytical & Logical Reasoning', subtopics: [
      'Number patterns and sequences', 'Arithmetic', 'Percentages', 'Ratios and proportions', 'Averages',
      'Time and clocks', 'Distance and speed', 'Counting and arrangements', 'Paths and networks',
      'Logical conditions and statements', 'Sets and grouping', 'Matching and assignment',
      'Ranking and ordering', 'Probability basics', 'Geometry', 'Angles', 'Triangles and quadrilaterals',
      'Circles and polygons', 'Area and perimeter', 'Volume and surface area',
      'Symmetry and coordinate-style reasoning', 'Basic algebra and equations', 'Tables, charts and graphs',
      'Pattern decoding', 'Symbol-based arithmetic', 'Estimation and checking'
    ]
  },
  {
    part: 'Part A', area: 'Language', subtopics: [
      'Reading comprehension', 'Main idea', 'Supporting details', 'Inference', 'Meaning from context',
      'Logical relationships between statements', 'Sentence interpretation', 'Vocabulary in context',
      'Understanding instructions', 'Understanding qualifiers — NOT, EXCEPT, ONLY, ALWAYS, etc.'
    ]
  },
  {
    part: 'Part A', area: 'Creativity', subtopics: [
      'Verbal analogies', 'Non-verbal analogies', 'Visual analogies', 'Metaphors', 'Visual metaphors',
      'Signs and symbols', 'Symbol interpretation', 'Pattern-based creative reasoning',
      'Multiple interpretations', 'Unusual but logical connections', 'Visual communication',
      'Form and function combinations', 'Creative problem solving'
    ]
  },
  {
    part: 'Part B', area: 'Drawing', subtopics: [
      'Line quality and controlled strokes', 'Basic shapes and forms', 'Circle and ellipse',
      'Square and rectangle', 'Cylinder, cone and sphere', 'Cuboid and box construction', 'Proportion',
      'Human figure', 'Standing pose', 'Walking pose', 'Sitting pose', 'Bending pose', 'Reaching pose',
      'Carrying pose', 'Action poses', 'People interacting with objects', 'Product drawing',
      'Furniture drawing', 'Everyday object drawing', 'One-point perspective', 'Two-point perspective',
      'Interior scenes', 'Exterior scenes', 'Horizon line / eye level', 'Vanishing points', 'Depth and scale',
      'Foreground, middle ground and background', 'Overlapping', 'Foreshortening — basic', 'Composition',
      'Light direction', 'Cast shadows', 'Basic shading', 'Texture indication', 'Visual storytelling',
      'Scene-based drawing', 'Clean and readable final drawing'
    ]
  },
  {
    part: 'Part B', area: 'Design Aptitude', subtopics: [
      'Understanding the problem', 'Understanding the user', 'User needs', 'Empathy', 'Context and situation',
      'Constraints', 'Function before decoration', 'Ergonomics', 'Grip, reach and access', 'Comfort', 'Safety',
      'Stability', 'Portability', 'Storage', 'Ease of use', 'Material selection', 'Simple mechanisms',
      'Practical construction', 'Design for children', 'Design for elderly users', 'Inclusive design',
      'Sustainable design', 'Reuse and upcycling', 'Public and community problems',
      'Emergency/problem-solving products', 'Multi-function products', 'Space-saving products',
      'Improving existing products', 'Generating multiple concepts', 'Creativity + feasibility',
      'Communicating the final solution', 'Showing how the product is used'
    ]
  }
];

const allSubtopics = areas.flatMap(area => area.subtopics.map(subtopic => ({ ...area, subtopic })));
const byKey = new Map(allSubtopics.map(item => [key(item.subtopic), item.subtopic]));
const rowsBySubtopic = new Map();
for (const item of allSubtopics) rowsBySubtopic.set(item.subtopic, [...(rowsBySubtopic.get(item.subtopic) || []), item]);
const rowKey = item => [item.part, item.area, item.subtopic].join('|');
const lookup = label => byKey.get(key(label));
function key(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

// These rules require explicit wording in the imported stem. Existing topic/category
// fields are never enough to confirm a subtopic; they only populate review candidates.
const evidenceRules = [
  ['Visual observation and attention to detail', /\b(count the number|count how many|number of occurrences|how many (different )?(types of )?(letters|fonts|symbols|leaves|people|objects|shapes|circles|squares|triangles|rectangles|cubes|patterns) (are|appear|there are|can be seen))\b|\b(count|number) of (circles|squares|triangles|rectangles|letters|fonts|symbols|objects|people|cubes)\b/i],
  ['Spot the difference', /\b(spot the difference|find the difference|different from the given|which .* differs|not part of the image)\b/i],
  ['Classification and grouping', /\b(classify|classification|group(ed|ing)?|categor(y|ies)|odd one out|which .* belong|which .* match(es)? the group)\b/i],
  ['Odd-one-out', /\b(odd one out|does not belong|which .* is unlike|which .* is different from the rest)\b/i],
  ['Hidden or concealed properties', /\b(hidden|concealed|embedded|hidden figure|embedded figure|find .* hidden)\b/i],
  ['Function from form', /\b(function from form|purpose of the (object|product|design)|what is .* used for|what does .* (mark|symbol|feature) represent)\b/i],
  ['Incorrect or impossible construction', /\b(impossible|cannot be constructed|not possible|not rigid|incorrect construction|which .* cannot be made)\b/i],
  ['Sequence of operation', /\b(sequence of steps|steps .* mixed up|correct logical sequence|order of operations|sequence of operation|steps to (tie|make|use))\b/i],
  ['Visual inference', /\b(which .* can be inferred|what can be inferred|infer .* from the (figure|image|picture)|based on the (figure|image|picture))\b/i],
  ['Prediction from visual information', /\b(predict .* (image|figure|shape|visual)|will .* look like|resulting (image|shape|colour|color)|after .* (rotate|fold|cut|move))\b/i],
  ['Reading comprehension', /\b(read the following (passage|paragraph|article|excerpt|text)|following paragraph|paragraph above|passage above|according to the (passage|paragraph|text))\b/i],
  ['Main idea', /\b(main idea|central idea|main argument|primarily about)\b/i],
  ['Supporting details', /\b(supporting detail|according to the passage|explicitly stated|mentioned in the passage)\b/i],
  ['Inference', /\b(implicit|inferred|inference|can be deduced from the passage|deduced from the paragraph)\b/i],
  ['Meaning from context', /\b(meaning .* context|contextual meaning|as used in the passage|meaning of .* in the passage)\b/i],
  ['Logical relationships between statements', /\b(statements? .* (true|false)|which of the following statements|conclusions? deduced|all .* some .* conclusions?)\b/i],
  ['Sentence interpretation', /\b(correct logical sequence of these sentences|sentences .* mixed up|interpret the sentence|sentence means)\b/i],
  ['Vocabulary in context', /\b(vocabulary|word meaning|meaning of the word|similar in meaning|synonym|antonym|idiom|phrase .* means)\b/i],
  ['Understanding instructions', /\b(instructions?|must use|not necessarily in order|assume that|choose .* such that)\b/i],
  ['Understanding qualifiers — NOT, EXCEPT, ONLY, ALWAYS, etc.', /\b(?:NOT|EXCEPT|ONLY|ALWAYS)\b/],
  ['Rotation and reflection', /\b(rotat(e|ed|es|ion|ions|ing)|reflect(ed|ing)? across (the )?(x|y|xy)? ?axis|flipped (horizontally|vertically|about)|flip(ped|ping)? .* axis|turn(ed|ing) .* (axis|degrees))\b/i],
  ['Mirror images and water images', /\b(mirror image|water image|two mirrors|mirror(s)? at|reflected in a mirror)\b/i],
  ['Symmetry — reflection and rotational', /\b(symmetr(y|ic|ical)|line of symmetry|rotational symmetry)\b/i],
  ['Figure completion', /\b(complete the (figure|image|shape)|missing block|which option .* complete(s)? the (figure|image|shape)|completes the (figure|visual pattern|shape sequence))\b/i],
  ['Embedded and hidden figures', /\b(embedded figure|hidden figure|hidden shape|embedded shape|find .* hidden|letters? .* embedded)\b/i],
  ['Paper folding, cutting and punching', /\b(paper is folded|paper folding|fold(ed|ing) .* paper|paper .* cut|folded .* cut|unfold(ed|ing) .* paper|punch(ed|ing))\b/i],
  ['Cube and cuboid nets', /\b(cube net|cuboid net|net of (a )?(cube|cuboid)|unfolded (cube|cuboid|box)|opened up surfaces|fold(ed|ing) to make .* (cube|cuboid|box))\b/i],
  ['Folding and unfolding 3D objects', /\b(fold(ed|ing) to make the 3d|unfold(ed|ing) view|fold(ed|ing) .* solid|fold(ed|ing) .* object|3d object .* fold)\b/i],
  ['Faces, edges and vertices', /\b(faces?|edges?|vertices|vertex|surfaces?)\b/i],
  ['Top, front and side views', /\b(top view|front view|side view|top, front|views? of the same (solid|object|cube)|view(s)? belong to the object)\b/i],
  ['Viewpoint and orientation', /\b(viewed from|viewpoint|orientation|different direction|from .* direction|point of view)\b/i],
  ['Perspective and depth', /\b(perspective|depth|vanishing point|one.point|two.point)\b/i],
  ['Cross-sections and slicing', /\b(cross.section|cross section|sectional (face|view)|slice(d|s|ing)? through (the )?(cube|solid|shape|circle|sphere)|cut(s|ting)? through (the )?(cube|solid|shape|circle|sphere))\b/i],
  ['Block arrangement and stacking', /\b(blocks? (are )?(stacked|arranged)|stack(ed|ing)|arrangement of cubes|number of cubes in the (figure|structure)|placed .* on top of)\b/i],
  ['Paths, grids and mazes', /\b(maze|grid|tiles? .* (move|path)|path .* (route|longest|shortest)|reach .* in the fewest steps|without visiting .* more than once)\b/i],
  ['Shadow direction', /\b(identify .* shadow|shadow .* direction|direction of (the )?shadow|where .* shadow|shadow of the object|shadow .* cast|length of (the )?shadow)\b/i],
  ['Spatial patterns and sequences', /\b(pattern sequence|visual pattern|pattern .* sequence|sequence .* shapes|repeated pattern|pattern completes|pattern that completes)\b/i],
  ['Everyday objects and mechanisms', /\b(mechanism|pulley|belt and pulley|gear(s)?|umbrella|latch|door latch|chair structure|scissors|calculator|camera body|hinged structure|fan .* rotate)\b/i],
  ['Simple machines', /\b(simple machine|lever|pulley|wheel.and.axle|inclined plane|screw|wedge)\b/i],
  ['Lever, pulley, wheel-and-axle, inclined plane, screw and wedge', /\b(lever|pulley|wheel.and.axle|inclined plane|screw|wedge)\b/i],
  ['Force, motion and gravity', /\b(force of gravity|gravit(y|ational)|acceleration|inertia|force .* applied|motion of (the )?(object|body|vehicle))\b/i],
  ['Friction', /\b(friction|frictional)\b/i],
  ['Balance and stability', /\b(balance|stability|stable|unstable|rigid structure|not rigid)\b/i],
  ['Centre of mass — basic intuition', /\b(centre|center) of (mass|gravity)\b/i],
  ['Light, reflection and refraction', /\b(refraction|refract(ed|ion)|light rays?|optical|colour filter|color filter|pinhole camera|convex lens|image formed by a lens)\b/i],
  ['Shadows', /\b(shadow formation|how .* shadows? (are|is) formed|shadow .* formed by|shadow due to (the )?(light|object))\b/i],
  ['Transparent, translucent and opaque materials', /\b(transparent|translucent|opaque)\b/i],
  ['Sound — basic everyday applications', /\b(sound quality|sound better|audio design|audio feedback|acoustic(s)?|loudness|sound frequency)\b/i],
  ['Heat and thermal expansion', /\b(heat|thermal|expand(s|ed|ing)?|temperature)\b/i],
  ['Materials and their properties', /\b(material properties|properties of (the )?(material|wood|metal|glass|plastic|paper|rubber|fabric)|material selection|which material|what material is|identify the material|made from (wood|metal|glass|plastic|paper|rubber|fabric))\b/i],
  ['Wood, metal, glass, plastic, paper, rubber and fabric', /\b(which material|what material|material properties|properties of (wood|metal|glass|plastic|paper|rubber|fabric)|made from (wood|metal|glass|plastic|paper|rubber|fabric))\b/i],
  ['Tools and their practical use', /\b(tool(s)?|hammer|screwdriver|wrench|pliers|cutting tool)\b/i],
  ['Joints, hinges, folds, handles and fasteners', /\b(hinge(d)? joint|joint(s)?|hinge(s)?|handle(s)?|fastener(s)?|screw(s)? .* join|interlocking rods)\b/i],
  ['Basic measurement, scale and estimation', /\b(estimate(d|s|ing)?|approximately|measurement|measure(d|ment)?|scale factor|scale ratio|convert .* (cm|mm|inch|pica|point|pixel)|pica|pixels?)\b/i],
  ['Reduce, reuse and recycle', /\b(reduce|reuse|recycle|recycling)\b/i],
  ['Repair and reuse', /\b(repair|repair and reuse|reuse)\b/i],
  ['Materials and environmental impact', /\b(environment(al)? impact|pollution|carbon footprint|greenhouse|sustainable|climate.change|environmentally friendly)\b/i],
  ['Waste management and segregation', /\b(waste|segregat(e|ion)|landfill|recyclable)\b/i],
  ['Water conservation', /\b(water conservation|water scarcity|conserve water)\b/i],
  ['Energy conservation', /\b(energy conservation|conserve energy|energy efficient|renewable energy)\b/i],
  ['Accessibility and inclusive design', /\b(accessibilit(y|ies)|inclusive design|different abilities|disabilit(y|ies)|wheelchair|accessible)\b/i],
  ['Design for children and elderly people', /\b(design for (children|elderly|older people)|needs of (children|elderly|older people)|children .* product design|elderly .* product design)\b/i],
  ['Design for people with different abilities', /\b(different abilities|disabilit(y|ies)|visually impaired|hearing impaired|accessible design)\b/i],
  ['Public spaces', /\b(public space(s)?|public place(s)?|design .* park|design .* street|public transport design)\b/i],
  ['Community needs', /\b(community needs|needs of the community|community problem|community .* design)\b/i],
  ['Transportation and mobility', /\b(transportation and mobility|mobility design|transportation design|public transport|transport system design)\b/i],
  ['Urban and rural contexts', /\b(urban|rural|village|city context)\b/i],
  ['Social behaviour and cultural context', /\b(cultural context|social behaviour|social behavior|cultural practice(s)?|cultural tradition(s)?|custom(s)? of)\b/i],
  ['Traditional crafts and objects', /\b(traditional craft(s)?|handicraft(s)?|traditional object(s)?|art movement|artist(s)?|painting(s)? by|designed by (raymond loewy|[a-z]+ [a-z]+)|indus valley|silk route|ancient india|traditional embroidery|folk art|architecture|shadow puppet theatre|wayang kulit)\b/i],
  ['Symbols and cultural practices', /\b(cultural practice(s)?|cultural symbol(s)?|ritual(s)?|symbol(s)? .* cultural)\b/i],
  ['Sustainable and climate-responsive design', /\b(sustainable development|climate.responsive design|climate.change|environmentally friendly design|green design)\b/i],
  ['Human impact on environment', /\b(human impact on (the )?environment|ill.effects on the environment|environmental concern(s)?|environmental damage|natural resource(s)?)\b/i],
  ['Number patterns and sequences', /\b(number sequence|sequence of numbers|number pattern|missing number|numerical sequence|f.number sequence|f\/[0-9.]+.*sequence|replace .* number)\b/i],
  ['Arithmetic', /\b(calculate|how many .* can be made|sum of|product of|ratio|profit ratio|money|cost|price|age(s)?|pages .* made|four digit number|f.number.*sequence|f\/[0-9.]+.*sequence)\b/i],
  ['Percentages', /\b(percent(age)?|percentage|per cent|\d+%|percent of)\b/i],
  ['Ratios and proportions', /\b(ratio(s)?|proportion(s)?|proportional|twice as|three times as)\b/i],
  ['Averages', /\b(average|mean score|average score)\b/i],
  ['Time and clocks', /\b(clock|hour hand|minute hand|time is|how many minutes|12 o.clock|time .* after)\b/i],
  ['Distance and speed', /\b(speed|distance|km\/hr|km per hour|travell?ed|train(s)? .* direction|race track)\b/i],
  ['Counting and arrangements', /\b(how many (ways|arrangements|people|objects)|arrange(ment)?s?|permutation|combination|handshake(s)?|drawn without replacement)\b/i],
  ['Paths and networks', /\b(path(s)?|network|route|tiles? .* without visiting|minimum number of .* between|robot(s)? .* contact)\b/i],
  ['Logical conditions and statements', /\b(which of the following statements|statements? (is|are) (true|false)|conclusions? .* statements?|conditions? are|rules are as follows)\b/i],
  ['Sets and grouping', /\b(sets? of|all .* some .* conclusions|venn|group of|belong to (the )?same|classif(y|ication)|grouping)\b/i],
  ['Matching and assignment', /\b(assigned to|assignment|match(ing)? .* (person|team|place|role)|identify .* correspond(s)? to|who .* lives|which .* belongs to whom)\b/i],
  ['Ranking and ordering', /\b(rank(ing)?|order(ed|ing)?|ascending|descending|least to greatest|greatest to least|first .* second .* third)\b/i],
  ['Probability basics', /\b(probabilit(y|ies)|chance that|randomly|at random|toss(ed)? .* dice|drawn without replacement)\b/i],
  ['Geometry', /\b(geometry|geometric|polygon(s)?|triangle(s)?|circle(s)?|square(s)?|rectangle(s)?|parallelogram(s)?|area|perimeter|volume|surface area|angle(s)?|sphere(s)?|cube(s)?|cuboid(s)?)\b/i],
  ['Angles', /\b(angle(s)?|degrees? (between|of)|\d+°)\b/i],
  ['Triangles and quadrilaterals', /\b(triangle(s)?|quadrilateral(s)?|parallelogram(s)?|rhombus|trapezium|trapezoid)\b/i],
  ['Circles and polygons', /\b(circle(s)?|polygon(s)?|hexagon(s)?|pentagon(s)?|octagon(s)?|heptagon(s)?|disc(s)?|disk(s)?)\b/i],
  ['Area and perimeter', /\b(area|perimeter|circumference)\b/i],
  ['Volume and surface area', /\b(volume|surface area|number of surfaces|faces? of the solid)\b/i],
  ['Symmetry and coordinate-style reasoning', /\b(coordinate(s)?|x.axis|y.axis|xy axis|quadrant|symmetry|symmetric)\b/i],
  ['Basic algebra and equations', /\b(equation|solve for|unknown value|how many .* equal|is equal to|algebra)\b/i],
  ['Tables, charts and graphs', /\b(table|chart|graph|axis|population pyramid|survey|data given|account figures|scores are given)\b/i],
  ['Pattern decoding', /\b(code(d)?|coded|replace(s)? the question mark|logic of the (sequence|pattern)|number(s)? are arranged in a particular order)\b/i],
  ['Symbol-based arithmetic', /\b(symbol(s)? .* number|shape(s)? correspond to different numbers|parrot(s)? .* elephant|symbolic equation)\b/i],
  ['Estimation and checking', /\b(estimate|approximately|at most|maximum number|minimum number|least number|check whether)\b/i],
  ['Signs and symbols', /\b(sign(s)?|symbol(s)?|logo(s)?|icon(s)?|symbolic)\b/i],
  ['Visual communication', /\b(logo(s)?|sign(s)?|symbol(s)?|poster|visual communication|font|typography|visual feature(s)?)\b/i],
  ['Verbal analogies', /\b(analogy|analogies|analogous|verbal analogy)\b/i],
  ['Non-verbal analogies', /\b(non.verbal analog(y|ies)|analogy .* figure)\b/i],
  ['Visual analogies', /\b(visual analogy|analogy .* image|analogy .* figure)\b/i],
  ['Metaphors', /\b(metaphor(s)?|metaphorical)\b/i],
  ['Visual metaphors', /\b(visual metaphor(s)?|idiom(s)? .* image|idiom(s)? .* visual)\b/i],
  ['Symbol interpretation', /\b(interpret .* symbol|meaning of .* symbol|symbol(s)? used for|symbol .* represent)\b/i],
  ['Pattern-based creative reasoning', /\b(pattern .* creative|creative pattern|complete .* pattern|visual pattern .* logic)\b/i],
  ['Multiple interpretations', /\b(multiple interpretation(s)?|more than one interpretation|different meanings)\b/i],
  ['Unusual but logical connections', /\b(unusual connection|unexpected connection|logical connection|relate(s)? .* to .* phrase)\b/i],
  ['Form and function combinations', /\b(form and function|function before decoration|designed to|product design|product .* function)\b/i],
  ['Creative problem solving', /\b(problem solving|solve .* problem|design a solution|solution .* user|design process|designing with)\b/i]
];

const metaAliases = new Map([
  ['pattern counting', ['Visual observation and attention to detail']],
  ['spot the difference', ['Spot the difference']],
  ['odd one out', ['Odd-one-out']],
  ['texture pattern matching', ['Spatial patterns and sequences']],
  ['pattern sequences', ['Number patterns and sequences', 'Spatial patterns and sequences']],
  ['spatial assembly', ['2D and 3D visualization', 'Figure completion']],
  ['2d and 3d visualization', ['2D and 3D visualization']],
  ['faces edges and vertices', ['Faces, edges and vertices']],
  ['cross sections and slicing', ['Cross-sections and slicing']],
  ['rotation and reflection', ['Rotation and reflection']],
  ['mirror images and water images', ['Mirror images and water images']],
  ['symmetry reflection and rotational', ['Symmetry — reflection and rotational']],
  ['paper folding cutting and punching', ['Paper folding, cutting and punching']],
  ['cube and cuboid nets', ['Cube and cuboid nets']],
  ['top front and side views', ['Top, front and side views']],
  ['perspective and depth', ['Perspective and depth']],
  ['block arrangement and stacking', ['Block arrangement and stacking']],
  ['paths grids and mazes', ['Paths, grids and mazes']],
  ['area perimeter volume and surface area', ['Geometry', 'Area and perimeter', 'Volume and surface area']],
  ['arithmetic', ['Arithmetic']],
  ['counting and arrangements', ['Counting and arrangements', 'Probability basics']],
  ['distance and speed', ['Distance and speed', 'Time and clocks']],
  ['logical conditions and statements', ['Logical conditions and statements']],
  ['sets and grouping', ['Sets and grouping']],
  ['tables charts and graphs', ['Tables, charts and graphs']],
  ['pattern decoding', ['Pattern decoding']],
  ['everyday objects and mechanisms', ['Everyday objects and mechanisms']],
  ['balance and stability', ['Balance and stability']],
  ['light reflection and refraction', ['Light, reflection and refraction', 'Shadows']],
  ['materials and their properties wood metal glass plastic paper rubber fabric', ['Materials and their properties']],
  ['usability', ['Usability', 'Human-object interaction']],
  ['traditional crafts and objects', ['Traditional crafts and objects']],
  ['natural environment and geography', ['Human impact on environment']],
  ['economy society', ['Social behaviour and cultural context']],
  ['gestalt principles of perception', ['Visual observation and attention to detail', 'Classification and grouping']],
  ['human anatomy proportion', ['Human figure', 'Proportion']],
  ['logo identification', ['Signs and symbols', 'Symbol interpretation', 'Visual communication']],
  ['reading comprehension', ['Reading comprehension']],
  ['signs and symbols symbol interpretation', ['Signs and symbols', 'Symbol interpretation']],
  ['colour and composition', ['Visual communication']],
  ['typography fonts', ['Visual communication']],
  ['sequence of operation', ['Sequence of operation', 'Prediction from visual information']]
]);
for (const [subtopic] of evidenceRules) if (!rowsBySubtopic.has(subtopic)) throw new Error('Evidence rule references unknown checklist subtopic: ' + subtopic);
for (const [label, candidates] of metaAliases) for (const candidate of candidates) if (!rowsBySubtopic.has(candidate)) throw new Error('Metadata alias "' + label + '" references unknown checklist subtopic: ' + candidate);

const papers = [
  ['uceed-2015.json', 2015], ['uceed-2016.json', 2016], ['uceed-2017.json', 2017],
  ['uceed-2018.json', 2018], ['uceed-2019.json', 2019], ['uceed-2020.json', 2020],
  ['uceed-2021.json', 2021], ['uceed-2022.json', 2022], ['uceed-2023.json', 2023],
  ['uceed-2024.json', 2024], ['uceed-2025-official-part-a.json', 2025], ['uceed-2026.json', 2026]
];
const sourcePdfs = {
  2015: 'UCEED2015_Question_Paper.pdf', 2016: 'UCEED2016_Question_Paper.pdf',
  2017: 'UCEED2017_Question_Paper.pdf', 2018: 'UCEED2018_Question_Paper.pdf',
  2019: 'UCEED2019_Question_Paper.pdf', 2020: 'UCEED2020_Question_Paper.pdf',
  2021: 'UCEED2021_Question_Paper.pdf', 2022: 'UCEED2022_Question_Paper.pdf',
  2023: 'UCEED_2023_Question_Paper.pdf', 2024: 'UCEED_2024_Question_Paper.pdf',
  2025: 'UCEED_2025_Question_Paper.pdf', 2026: 'UCEED_2026_Question_Paper.pdf'
};

const matrix = new Map(allSubtopics.map(item => [rowKey(item), {
  ...item, confirmedQuestionRefs: [], reviewCandidates: []
}]));
const questions = [];
for (const [file, year] of papers) {
  const exam = JSON.parse(await readFile(path.join(fixtureDir, file), 'utf8'));
  for (const q of exam.questions || []) {
    const prompt = String(q.prompt || '').trim();
    const direct = new Set();
    for (const [subtopic, regex] of evidenceRules) if (regex.test(prompt)) direct.add(subtopic);
    const candidates = new Set(metaAliases.get(key(q.topic)) || []);
    const normalized = key(q.topic);
    const exact = lookup(q.topic);
    if (exact) candidates.add(exact);
    const sectionTitle = key(exam.sections?.find(section => section.id === q.sectionId)?.title);
    for (const item of allSubtopics) {
      if (sectionTitle && key(item.subtopic) === sectionTitle) candidates.add(item.subtopic);
    }
    for (const topic of direct) candidates.add(topic);
    const ref = {
      paper: `UCEED ${year}`, year, questionId: q.id,
      fixture: file, sourcePdf: sourcePdfs[year], promptExcerpt: prompt.replace(/\s+/g, ' ').slice(0, 220),
      imagePresent: Boolean(q.image), existingTopic: q.topic || null,
      existingCategory: q.category || null
    };
    for (const topic of direct) for (const item of rowsBySubtopic.get(topic) || []) matrix.get(rowKey(item)).confirmedQuestionRefs.push(ref);
    for (const topic of candidates) if (!direct.has(topic)) for (const item of rowsBySubtopic.get(topic) || []) matrix.get(rowKey(item)).reviewCandidates.push({ ...ref, reason: 'Existing topic/category is a lead only; confirm against the source question and diagram.' });
    const directAreas = new Set([...direct].flatMap(topic => (rowsBySubtopic.get(topic) || []).map(item => item.area)));
    const categoryArea = areas.find(item => key(item.area) === key(q.category))?.area;
    const topicRows = [...(metaAliases.get(key(q.topic)) || [])].flatMap(topic => rowsBySubtopic.get(topic) || []);
    if (exact) topicRows.push(...(rowsBySubtopic.get(exact) || []));
    const topicConflict = topicRows.length > 0 && direct.size > 0 && !topicRows.some(item => direct.has(item.subtopic));
    const categoryConflict = Boolean(categoryArea && directAreas.size && !directAreas.has(categoryArea));
    const tagReviewStatus = topicConflict && categoryConflict ? 'topic-and-category-conflict-with-stem-cue'
      : topicConflict ? 'topic-conflict-with-stem-cue'
        : categoryConflict ? 'category-conflict-with-stem-cue' : 'no-clear-conflict';
    questions.push({
      ...ref,
      evidenceStatus: direct.size ? 'stem-evidence' : candidates.size ? 'metadata-review' : 'unmapped-review',
      syllabusSubtopics: [...direct].flatMap(topic => (rowsBySubtopic.get(topic) || []).map(item => ({ part: item.part, area: item.area, subtopic: item.subtopic }))),
      candidateSubtopics: [...candidates].filter(topic => !direct.has(topic)),
      tagReviewStatus
    });
  }
}

for (const item of matrix.values()) {
  item.confirmedQuestionRefs.sort(refSort);
  item.reviewCandidates.sort(refSort);
  item.status = item.confirmedQuestionRefs.length ? 'stem-evidence' : item.reviewCandidates.length ? 'review-candidates-only' : 'no-evidence-found';
}
const questionKeys = questions.map(q => [q.year, q.questionId].join(':'));
if (new Set(questionKeys).size !== questions.length) throw new Error('Duplicate year/question identifiers in the official-paper fixture inventory.');
for (const item of matrix.values()) for (const ref of [...item.confirmedQuestionRefs, ...item.reviewCandidates]) {
  if (!questionKeys.includes([ref.year, ref.questionId].join(':'))) throw new Error('Dangling question reference in checklist matrix: ' + ref.year + ':' + ref.questionId);
}
function refSort(a, b) { return a.year - b.year || String(a.questionId).localeCompare(String(b.questionId), undefined, { numeric: true }); }

const partB = [...matrix.values()].filter(item => item.part === 'Part B');
for (const item of partB) item.status = 'uncovered-no-part-b-papers-in-inventory';
const report = {
  generatedAt: new Date().toISOString(),
  title: 'UCEED checklist subtopic coverage audit',
  scope: {
    syllabusSource: 'User-supplied media_1790718535711.pdf; preparation checklist, explicitly not an official IIT Bombay chapter-by-chapter list.',
    inventory: papers.map(([fixture, year]) => ({ paper: `UCEED ${year}`, year, fixture, questionCount: questions.filter(q => q.year === year).length })),
    excluded: ['Practice/mock-only fixtures and demo fixtures are not counted as past-paper coverage.'],
    totalQuestions: questions.length,
    historicalChart: { yearlyQuestionTotal: 878, sumOfDisplayedTopicRows: 958, note: 'The year total matches the current fixture inventory; topic rows overlap and are descriptive, not quotas.' },
    partASubtopics: allSubtopics.filter(item => item.part === 'Part A').length,
    partBSubtopics: allSubtopics.filter(item => item.part === 'Part B').length,
    totalSubtopics: allSubtopics.length,
    method: 'Confirmed mappings use explicit wording in the imported question stem and include a prompt excerpt. Existing topic/category labels are only review candidates. Image-dependent concepts are not inferred from file presence alone; review candidate and unmapped questions require source/diagram review.',
    limitations: ['Stem evidence is a conservative text audit, not independent page-by-page visual verification of all 878 source PDF questions.', 'Subtopic overlaps are allowed; per-subtopic counts therefore do not sum to paper question totals.', 'Zero stem evidence is not by itself proof that a subtopic never occurs in an image-led question.']
  },
  summary: {
    questionsWithStemEvidence: questions.filter(q => q.evidenceStatus === 'stem-evidence').length,
    questionsNeedingMetadataOrImageReview: questions.filter(q => q.evidenceStatus === 'metadata-review').length,
    questionsUnmapped: questions.filter(q => q.evidenceStatus === 'unmapped-review').length,
    questionsWithPotentialTagConflict: questions.filter(q => q.tagReviewStatus !== 'no-clear-conflict').length,
    questionsRequiringReview: questions.filter(q => q.evidenceStatus !== 'stem-evidence' || q.tagReviewStatus !== 'no-clear-conflict').length,
    partBQuestionsInInventory: 0,
    statuses: Object.fromEntries(['stem-evidence', 'review-candidates-only', 'no-evidence-found', 'uncovered-no-part-b-papers-in-inventory'].map(status => [status, [...matrix.values()].filter(item => item.status === status).length]))
  },
  subtopics: [...matrix.values()],
  questions: questions.sort(refSort)
};

await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const partSummaries = ['Part A', 'Part B'].map(part => {
  const rows = report.subtopics.filter(item => item.part === part);
  const confirmed = rows.filter(item => item.confirmedQuestionRefs.length);
  const candidates = rows.filter(item => !item.confirmedQuestionRefs.length && item.reviewCandidates.length);
  const none = rows.filter(item => !item.confirmedQuestionRefs.length && !item.reviewCandidates.length);
  return `### ${part}\n\n- Checklist subtopics: ${rows.length}\n- Subtopics with stem evidence: ${confirmed.length}\n- Subtopics with metadata-only review candidates: ${candidates.length}\n- Subtopics with no direct or metadata evidence: ${none.length}\n\n` +
    `**Subtopics with no stem evidence:** ${none.map(item => item.subtopic).join('; ') || 'None'}\n\n` +
    `**Metadata-only candidates needing source/diagram review:** ${candidates.map(item => `${item.subtopic} (${item.reviewCandidates.length}: ${ids(item.reviewCandidates)})`).join('; ') || 'None'}\n\n` +
    `**Stem-evidenced subtopics and question references:**\n\n` + confirmed.map(item => `- **${item.subtopic}** — ${item.confirmedQuestionRefs.length}: ${ids(item.confirmedQuestionRefs)}`).join('\n') + '\n\n';
});
function ids(refs) { return refs.map(ref => `${ref.year}:${ref.questionId}`).join(', '); }
const uncertain = questions.filter(q => q.evidenceStatus !== 'stem-evidence' || q.tagReviewStatus !== 'no-clear-conflict');
const markdown = `# UCEED checklist subtopic coverage audit\n\nGenerated ${report.generatedAt}. Detailed evidence and all question-level records are in [the JSON report](uceed-syllabus-subtopic-coverage.json).\n\n## Scope and method\n\n- Inventory: ${questions.length} questions from 12 imported official UCEED Part-A paper fixtures, 2015–2026. Practice-only fixtures are excluded.\n- Checklist: ${allSubtopics.length} subtopics (Part A: ${report.scope.partASubtopics}; Part B: ${report.scope.partBSubtopics}) transcribed from the user-supplied preparation checklist.\n- Part-B status: no Part-B source paper fixture is present in this inventory; its ${report.scope.partBSubtopics} checklist subtopics are uncovered in the current official-paper bank.\n- Confirmed means explicit evidence in the imported question stem, not page-by-page image/key verification. Existing tags only create review candidates.\n- A subtopic with no text hit may still appear in a diagram-led question; it is marked as no evidence, not an absolute proof of absence.\n- Subtopic counts overlap and are not expected to add up to the total paper questions.\n\n## Findings\n\n- Questions with one or more explicit stem cues: ${report.summary.questionsWithStemEvidence}/${questions.length}.\n- Questions needing label/diagram review: ${report.summary.questionsNeedingMetadataOrImageReview}.\n- Questions without a text cue or candidate label: ${report.summary.questionsUnmapped}.\n- Checklist subtopics by status: ${JSON.stringify(report.summary.statuses)}.\n\n${partSummaries.join('')}## Uncertain and unmapped question inventory\n\nAll non-confirmed questions are listed here by paper/year/question ID; their prompt and existing labels are available in the JSON report.\n\n${uncertain.length ? uncertain.map(q => `- ${q.year} ${q.questionId} — ${q.evidenceStatus}; candidates: ${q.candidateSubtopics.join(', ') || 'none'}${q.imagePresent ? '; has diagram' : ''}`).join('\n') : 'None.'}\n\n## Next verification\n\nIndependently inspect source PDF pages and diagrams for the uncertain question IDs, correct erroneous existing labels, then rerun this audit. Source and verify Part-B drawing/design questions before claiming any Part-B coverage.\n`;
const statusLine = '- Checklist subtopics by status: ' + JSON.stringify(report.summary.statuses) + '.';
const updatedMarkdown = markdown
  .replace('- Inventory: ' + questions.length + ' questions from 12 imported official UCEED Part-A paper fixtures, 2015–2026. Practice-only fixtures are excluded.',
    '- Inventory: ' + questions.length + ' questions from 12 imported official UCEED Part-A paper fixtures, 2015–2026. Practice-only fixtures are excluded.\n- Historical chart totals: 878 by year and 958 across topic rows; the rows overlap, so they are descriptive, not quotas.')
  .replace(statusLine, statusLine + '\n- Questions where existing topic/category may conflict with stem cues: ' + report.summary.questionsWithPotentialTagConflict + '.')
  .replace('- Questions without a text cue or candidate label: ' + report.summary.questionsUnmapped + '.',
    '- Questions without a text cue or candidate label: ' + report.summary.questionsUnmapped + '.\n- Questions requiring follow-up review: ' + report.summary.questionsRequiringReview + '.')
  .replace('Confirmed means explicit evidence in the imported question stem, not page-by-page image/key verification. Existing tags only create review candidates.',
    'Stem-evidenced means wording in the imported prompt triggered a mapping rule; it remains a candidate, not independent page-by-page source-PDF verification. Existing tags only create review candidates.')
  .replace('All non-confirmed questions are listed here by paper/year/question ID; their prompt and existing labels are available in the JSON report.',
    'All questions needing review are listed here by paper/year/question ID; fixture, source PDF, prompt excerpt, image presence and existing labels are available in the JSON report.');
await writeFile(outputMarkdown, updatedMarkdown, 'utf8');
console.log(JSON.stringify({ json: outputJson, markdown: outputMarkdown, questions: questions.length, subtopics: allSubtopics.length, questionStatuses: report.summary, subtopicStatuses: report.summary.statuses }, null, 2));
