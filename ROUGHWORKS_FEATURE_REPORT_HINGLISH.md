# Roughworks Feature Report (Hinglish)

## Scope

This report documents the live Roughworks site review completed on 30 September 2026. It covers public pages, the signed-in dashboard, practice flows, timed papers, GK Sprint, drawing/community features, analytics, leaderboard, guides, settings, support, privacy, and the paid All India Mock flow.

## Product map

Roughworks is a design-entrance preparation platform for UCEED, CEED, NID and NIFT. Its product has three connected layers: a public question/paper library, a signed-in learning dashboard, and a community plus paid live-mock layer.

## Public learning library

- Homepage: exam navigation, topic navigation, dashboard CTA, mock CTA, drawing CTA, community previews, WhatsApp group and support links.
- Question bank: search, exam/year/type/topic/difficulty filters, skip-done control, browse mode, practice mode, 10/25/50/custom set sizes, question attempt counts and direct paper links.
- Public paper archive: free UCEED, CEED, NID UG and NIFT papers; full-paper attempt mode; browse-question mode; marking schemes; progress saving; section breakdown.
- Syllabus map: topic-by-year heatmap, total counts, direct topic/year practice links, FAQs and exam navigation. UCEED live page showed 878 Part A questions across 2015–2026.
- Guides: exam-specific filters, reading time, updated date, long-form strategy, data analysis, quick quizzes and internal practice links.

## Account and dashboard

- Google OAuth sign-in and optional profile onboarding.
- Settings: display name, username, optional phone, target exam, target year, appearance, profile ID and sign-out.
- Overview: greeting, target exam, Sparks, leaderboard status, date-range stats, exam filter, consistency calendar, next-best-action carousel, recent mock attempts, topic mastery, recent Sparks, recommended sets and optimization snapshot.
- Saved progress: paper and practice progress is retained so a student can resume.

## Practice engine

- Custom set builder filters by exam, year, search, MCQ/MSQ/NAT, difficulty and 18 design topics.
- Skip previously completed questions; choose 10, 25, 50 or custom size; name the set.
- Saved sets have Start, Rename, Redo and Delete actions.
- Workspace has question jump navigation, previous/next, bookmark, discrepancy report, question image, answer options and finish-set control.
- Discrepancy categories: incorrect answer, typo/wording, unclear question, image/visual and other, with optional details.
- Practice questions expose temporary rough work, question metadata, attempt count and answer submission.

## Timed exam engine

- Dedicated exam-style window with server-controlled timer, question palette, section switching, Save & Next, Mark for Review & Next, Clear Response and automatic end at timeout.
- Status model: not visited, visited/unanswered, answered, marked for review, answered-and-marked-for-review.
- Question detail supports marking scheme, answer reveal after practice, bookmarking, issue reporting and a practice-only rough-work overlay.

## Analytics

- Range controls: 30 days, 90 days and all time.
- KPI cards: mock average, latest mock, best mock, overall accuracy, active days and GK accuracy.
- Diagnostic cards: marks leaking, GK retention, mock timeline, question-type strategy, topic risk map, strengths, weaknesses, opportunities and threats.
- Next-45-minutes action recommendations.
- Important product requirement: started, answered, submitted and graded states must remain visibly distinct so Overview, Papers and Analytics never appear contradictory.

## GK Sprint

- Flashcards, 10-question quizzes and Wrong Box review.
- Cooldown controls: off, 1/3/7/14/28 days.
- Topic groups cover Nobel Prizes, Indian culture, design theory, architecture, museums, artists, textiles, literature, monuments and more.
- Flashcard outcomes: Knew it, Unsure, Did not know, Skip and Exit.
- Topic cards show available count, progress, Flashcards and Quiz actions.

## Drawing and community

- 121 drawing prompts from UCEED, CEED, NID, NIFT and original practice.
- Search, source, category, duration and sort filters.
- Categories include Product Design, Perspective, Sketching, Storyboarding, Illustration, Visual Sensitivity, Form Sensitivity and Problem Identification.
- Prompt page: brief, tags, adjustable timer, pencil/no-colour notes, marks and evaluation rubric.
- Upload: PNG/JPG up to 25 MB, optional description, public identity or anonymous submission.
- Gallery: search, source/category filters, newest/most appreciated sorting, claps, comments, replies, reports, similar sketches and sharing.
- Sketch Studio tracks submitted work and links back to prompts.

## Sparks and leaderboard

- Sparks rewards correct answers, partial MSQ credit, GK attempts, timed mocks, daily questions, login streaks and practice-set multiplier.
- Leaderboard ranks users by all-time points, supports anonymous display and requires more than 25 points for ranking.

## Paid UCEED 2027 All India Mock

- Event date: 25 October 2026, 10:00 AM IST; 100 seats; Part A + Part B; 300 marks.
- Solo early-bird price: ₹99; Friends early-bird price: ₹149 for two.
- Registration includes personal details, home state, category, PwD status and payment through Razorpay.
- Companion-code claim flow lets a prepaid second participant register.
- Event page explains exact interface, exam-day schedule, paper blueprint, human Part B evaluation, cohort rank, analytics and released solutions.
- Schedule includes 9:00 login window, 10:00 Part A, 10:30 last entry, 12:00 Part B, 1:30 final upload and 1 November result release.

## Support, privacy and external links

- Contact via WhatsApp, email, Reddit, GitHub, Instagram and LinkedIn.
- Privacy page documents Supabase Auth, GA4, AWS S3, Vercel, Amazon SES, Razorpay and optional public sketch uploads.
- Users can request account/data deletion by email.
- Anonymous public browsing is supported; signed-in dashboard activity is account-linked.

## Review observations

- Strong: broad PYQ library, topic/year heatmap, realistic paper workspace, custom practice, GK revision, drawing rubric and community feedback loop.
- Alignment risks: status terminology differs across Overview/Papers/Analytics; paid mock needs a clearer free-versus-paid boundary; empty analytics should avoid premature negative diagnosis; loading states need retry/timeout handling; recommendation time windows should be realistic.
- Unverified in this review: mobile breakpoints, payment completion, actual live event submission, and production cross-device sync.
