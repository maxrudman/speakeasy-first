/**
 * Sample terms for SPEAKEASY_MOCK_AI=1: lets you try vocabulary tailoring locally without
 * calling the Claude API. The mock builds each batch with the same field / audience / broad
 * mix and the same selection rules as the real path, from these hand-written lists.
 *
 * "{field}" and "{audience}" in examples are filled in with the user's own answers.
 * Field and audience lists aren't split by level; broad terms come from fallback-terms.ts by level.
 */

export type MockEntry = { term: string; partOfSpeech: string; definition: string; example: string };

type FieldBank = { key: string; match: RegExp; terms: MockEntry[] };

export const MOCK_FIELD_BANKS: FieldBank[] = [
  {
    key: "psychology",
    match: /psych|behavio(u)?ral science|counsel/i,
    terms: [
      { term: "cognitive bias", partOfSpeech: "noun", definition: "A predictable pattern of thinking that pulls judgment away from what the evidence shows.", example: "In my research project I designed the survey to reduce cognitive bias in how people rated each option." },
      { term: "intrinsic motivation", partOfSpeech: "noun", definition: "The drive to do something because it is satisfying in itself, not for a reward.", example: "I look for ways to build intrinsic motivation, like giving people real ownership of their work." },
      { term: "operant conditioning", partOfSpeech: "noun", definition: "Learning in which behavior changes because of the rewards or consequences that follow it.", example: "Our app's streak feature is basically operant conditioning: small, steady rewards that build a habit." },
      { term: "confirmation bias", partOfSpeech: "noun", definition: "The tendency to notice and favor information that supports what you already believe.", example: "Before I share findings, I check for confirmation bias by looking for data that disagrees with me." },
      { term: "empirical", partOfSpeech: "adjective", definition: "Based on observation or experiment rather than theory alone.", example: "I like to make decisions on empirical evidence, so I ran a small test before recommending the change." },
      { term: "self-efficacy", partOfSpeech: "noun", definition: "A person's belief in their own ability to succeed at a specific task.", example: "Breaking the training into small wins raised people's self-efficacy and their completion rates." },
    ],
  },
  {
    key: "business",
    match: /business|management|commerce|mba|entrepreneur|operations/i,
    terms: [
      { term: "value proposition", partOfSpeech: "noun", definition: "A clear statement of why a customer should choose your product or service.", example: "I rewrote our value proposition in one sentence so new customers understood it in seconds." },
      { term: "return on investment", partOfSpeech: "noun", definition: "How much benefit you get back compared with what you spent.", example: "I tracked the return on investment of each campaign so we could move budget to what worked." },
      { term: "market segmentation", partOfSpeech: "noun", definition: "Dividing customers into groups with similar needs so you can serve each group better.", example: "Our market segmentation showed that students and new grads needed a completely different message." },
      { term: "key performance indicator", partOfSpeech: "noun", definition: "A measurable value that shows how well a team or business is meeting a goal.", example: "We picked one key performance indicator per quarter so the whole team knew what success looked like." },
      { term: "competitive advantage", partOfSpeech: "noun", definition: "Something that lets a business do better than its competitors.", example: "Our competitive advantage was response time, so I built the process around keeping it fast." },
      { term: "cost-benefit analysis", partOfSpeech: "noun", definition: "Comparing the costs of a decision with its expected benefits before making it.", example: "I ran a quick cost-benefit analysis before recommending we switch vendors." },
    ],
  },
  {
    key: "design",
    match: /design|ux|ui\b|graphic|interaction|product design/i,
    terms: [
      { term: "user persona", partOfSpeech: "noun", definition: "A realistic profile of a typical user, used to guide design decisions.", example: "We built three user personas from interviews, and every design review started with them." },
      { term: "wireframe", partOfSpeech: "noun", definition: "A simple layout sketch of a screen that shows structure before visual design.", example: "I shared rough wireframes early so the team could react before we spent time on polish." },
      { term: "usability testing", partOfSpeech: "noun", definition: "Watching real people use a product to find where it is confusing or hard to use.", example: "Usability testing with five students showed us exactly where people got stuck." },
      { term: "visual hierarchy", partOfSpeech: "noun", definition: "Arranging elements so the most important thing is noticed first.", example: "I fixed the visual hierarchy so the main action stands out on every page." },
      { term: "accessibility", partOfSpeech: "noun", definition: "Designing so people with disabilities can use a product fully.", example: "I checked color contrast and keyboard navigation to make sure accessibility wasn't an afterthought." },
      { term: "prototype", partOfSpeech: "noun", definition: "An early, testable version of a product used to try out ideas.", example: "A clickable prototype let us test the idea in two days instead of building it for two months." },
    ],
  },
  {
    key: "law",
    match: /\blaw\b|legal|attorney|lawyer|paralegal|litigation/i,
    terms: [
      { term: "due diligence", partOfSpeech: "noun", definition: "A careful investigation of a company or deal before signing an agreement.", example: "During due diligence I flagged two contracts that would have transferred liability to our client." },
      { term: "fiduciary duty", partOfSpeech: "noun", definition: "A legal duty to act in the best interests of another party, such as shareholders.", example: "I framed the recommendation around the board's fiduciary duty to shareholders." },
      { term: "indemnification", partOfSpeech: "noun", definition: "A contract promise by one party to cover the other's losses in certain situations.", example: "I negotiated the indemnification clause so our client wasn't covering risks it couldn't control." },
      { term: "material adverse change", partOfSpeech: "noun", definition: "A significant negative event that can let a party walk away from a deal.", example: "We drafted the material adverse change clause narrowly to keep the deal on track." },
      { term: "representations and warranties", partOfSpeech: "noun", definition: "Statements of fact in a contract that a party promises are true.", example: "I reviewed the representations and warranties line by line against the disclosure schedules." },
      { term: "corporate governance", partOfSpeech: "noun", definition: "The rules and processes by which a company is directed and controlled.", example: "My research focused on how corporate governance reforms changed board oversight." },
      { term: "regulatory compliance", partOfSpeech: "noun", definition: "Following the laws and rules that apply to a business.", example: "I built a checklist that made regulatory compliance reviews faster and more consistent." },
      { term: "precedent", partOfSpeech: "noun", definition: "An earlier court decision used as a guide for deciding later cases.", example: "I found a precedent from the Delaware Chancery Court that supported our reading of the clause." },
      { term: "non-disclosure agreement", partOfSpeech: "noun", definition: "A contract in which parties agree to keep certain information confidential.", example: "I drafted the non-disclosure agreement so talks could start the same week." },
      { term: "redline", partOfSpeech: "verb", definition: "To mark up a draft contract to show proposed changes.", example: "I redlined the purchase agreement overnight so the partner could review it first thing." },
    ],
  },
  {
    key: "nursing",
    match: /nurs|health ?care|medical|clinical|hospital|patient care/i,
    terms: [
      { term: "vital signs", partOfSpeech: "noun", definition: "Basic body measurements like heart rate, breathing, temperature and blood pressure.", example: "I'll check her vital signs every hour tonight and let you know if anything changes." },
      { term: "care plan", partOfSpeech: "noun", definition: "A written plan of the care a patient needs and the goals of that care.", example: "Let's go over his care plan together so you know what to expect this week." },
      { term: "discharge planning", partOfSpeech: "noun", definition: "Preparing a patient and family for a safe move home or to another care setting.", example: "We'll start discharge planning today so you have everything ready before she goes home." },
      { term: "medication reconciliation", partOfSpeech: "noun", definition: "Comparing all of a patient's medicines to avoid mistakes when care changes.", example: "Could you bring his medicines from home? We'll do a medication reconciliation to make sure nothing is missed." },
      { term: "informed consent", partOfSpeech: "noun", definition: "Agreement to a treatment after its risks, benefits and options have been explained.", example: "Before the procedure, the doctor will go over informed consent with you and answer every question." },
      { term: "fall risk", partOfSpeech: "noun", definition: "How likely a patient is to fall, based on things like medicine, strength and confusion.", example: "Because of his new medicine he's a fall risk, so please call us before helping him to the bathroom." },
      { term: "triage", partOfSpeech: "noun", definition: "Sorting patients by how urgently they need care.", example: "In the emergency department, triage means the sickest patients are seen first." },
      { term: "hand hygiene", partOfSpeech: "noun", definition: "Cleaning your hands properly to stop infections from spreading.", example: "Please use the hand gel when you come in; hand hygiene protects him from infection." },
      { term: "pain scale", partOfSpeech: "noun", definition: "A simple way of rating pain, usually from 0 (none) to 10 (worst).", example: "I'll ask her to rate her pain on a pain scale from zero to ten so we can track it." },
      { term: "shift report", partOfSpeech: "noun", definition: "The update one nurse gives the next nurse when their shift ends.", example: "The night nurse will get a full shift report, so she'll know everything we talked about." },
    ],
  },
  {
    key: "software",
    match: /software|computer|programming|developer|engineering|data|tech/i,
    terms: [
      { term: "technical debt", partOfSpeech: "noun", definition: "The future cost of choosing a quick solution now instead of a better one.", example: "I set aside time each sprint to pay down technical debt before it slowed us down." },
      { term: "code review", partOfSpeech: "noun", definition: "Checking another developer's code for problems before it is merged.", example: "Code review is where I learned the most on my last team." },
      { term: "scalability", partOfSpeech: "noun", definition: "A system's ability to handle more users or data without breaking down.", example: "I redesigned the query so scalability wouldn't become a problem as usage grew." },
      { term: "continuous integration", partOfSpeech: "noun", definition: "Automatically building and testing code every time someone changes it.", example: "We added continuous integration so bugs were caught within minutes, not weeks." },
      { term: "edge case", partOfSpeech: "noun", definition: "An unusual situation at the limits of how a system is expected to work.", example: "I wrote tests for every edge case I could think of, like empty forms and huge files." },
      { term: "minimum viable product", partOfSpeech: "noun", definition: "The simplest version of a product that is still useful enough to test with real users.", example: "We shipped a minimum viable product in three weeks and let user feedback drive the rest." },
    ],
  },
  {
    key: "finance",
    match: /financ|accounting|bank|invest|audit|econom/i,
    terms: [
      { term: "cash flow", partOfSpeech: "noun", definition: "The money moving into and out of a business over a period of time.", example: "I built a weekly cash flow forecast so we could spot shortfalls a month ahead." },
      { term: "liquidity", partOfSpeech: "noun", definition: "How easily assets can be turned into cash without losing value.", example: "We kept enough liquidity to cover three months of expenses." },
      { term: "variance analysis", partOfSpeech: "noun", definition: "Comparing actual results with the budget and explaining the differences.", example: "My variance analysis showed the overspend came from one vendor contract." },
      { term: "diversification", partOfSpeech: "noun", definition: "Spreading investments across different assets to reduce risk.", example: "I recommended more diversification so one bad quarter wouldn't sink the portfolio." },
      { term: "due diligence", partOfSpeech: "noun", definition: "A careful investigation of a company or investment before committing to it.", example: "I handled the financial due diligence, checking three years of statements." },
    ],
  },
  {
    key: "marketing",
    match: /marketing|advertis|brand|communications|public relations|\bpr\b/i,
    terms: [
      { term: "target audience", partOfSpeech: "noun", definition: "The specific group of people a message or product is meant for.", example: "Once we narrowed the target audience to new grads, engagement doubled." },
      { term: "conversion rate", partOfSpeech: "noun", definition: "The share of people who take a desired action, like signing up.", example: "I raised the sign-up page's conversion rate by cutting the form from eight fields to three." },
      { term: "brand positioning", partOfSpeech: "noun", definition: "How a brand wants customers to see it compared with competitors.", example: "Our brand positioning was simple: the friendliest option for first-time buyers." },
      { term: "A/B testing", partOfSpeech: "noun", definition: "Comparing two versions of something to see which performs better.", example: "A/B testing two subject lines showed the shorter one got far more opens." },
      { term: "customer acquisition cost", partOfSpeech: "noun", definition: "The average cost of winning one new customer.", example: "I cut our customer acquisition cost by moving spend to referrals." },
    ],
  },
  {
    key: "education",
    match: /educat|teach|school|tutor|instruction/i,
    terms: [
      { term: "differentiated instruction", partOfSpeech: "noun", definition: "Adjusting teaching to fit different students' needs and levels.", example: "I use differentiated instruction so advanced students stay challenged while others get support." },
      { term: "formative assessment", partOfSpeech: "noun", definition: "Checking understanding during learning to adjust teaching, not to grade.", example: "Quick formative assessments at the end of each class tell me what to reteach." },
      { term: "learning objective", partOfSpeech: "noun", definition: "A clear statement of what students should be able to do after a lesson.", example: "Every lesson starts with one learning objective written on the board." },
      { term: "scaffolding", partOfSpeech: "noun", definition: "Temporary support that helps learners do something they can't yet do alone.", example: "I add scaffolding like sentence starters, then remove it as students gain confidence." },
      { term: "classroom management", partOfSpeech: "noun", definition: "The routines and strategies that keep a class focused and productive.", example: "Clear routines are the core of my classroom management." },
    ],
  },
];

/** Bridge terms that genuinely connect two fields. */
export const MOCK_BRIDGES: { between: [string, string]; entry: MockEntry }[] = [
  { between: ["psychology", "design"], entry: { term: "user research", partOfSpeech: "noun", definition: "Studying how people behave and what they need, to inform what you design.", example: "My psychology training makes me strong at user research: I know how to ask questions without leading people." } },
  { between: ["psychology", "design"], entry: { term: "cognitive load", partOfSpeech: "noun", definition: "The amount of mental effort a task or screen asks of a person.", example: "I simplified the checkout to reduce cognitive load, and drop-offs fell." } },
  { between: ["psychology", "business"], entry: { term: "organizational behavior", partOfSpeech: "noun", definition: "The study of how people act and work together inside organizations.", example: "I studied organizational behavior, so I think a lot about how team structure shapes results." } },
  { between: ["psychology", "business"], entry: { term: "consumer behavior", partOfSpeech: "noun", definition: "How people decide what to buy and why.", example: "Understanding consumer behavior helped me explain why customers abandoned their carts." } },
  { between: ["business", "design"], entry: { term: "design thinking", partOfSpeech: "noun", definition: "A problem-solving approach that starts with users' needs and tests ideas quickly.", example: "We used design thinking to rework onboarding, starting with interviews instead of assumptions." } },
  { between: ["business", "design"], entry: { term: "customer journey map", partOfSpeech: "noun", definition: "A diagram of every step a customer goes through when using a product or service.", example: "Our customer journey map showed the biggest frustration was after purchase, not before." } },
  { between: ["law", "business"], entry: { term: "mergers and acquisitions", partOfSpeech: "noun", definition: "Deals in which companies combine or one company buys another.", example: "I'm drawn to mergers and acquisitions because it sits right where law meets business strategy." } },
  { between: ["nursing", "psychology"], entry: { term: "therapeutic communication", partOfSpeech: "noun", definition: "Talking with patients in a way that supports their emotional and physical well-being.", example: "I rely on therapeutic communication when families are scared and need to feel heard." } },
];

export const MOCK_AUDIENCE_BANKS: { match: RegExp; terms: MockEntry[] }[] = [
  {
    match: /hiring|recruit|interview|employer/i,
    terms: [
      { term: "cross-functional", partOfSpeech: "adjective", definition: "Involving people from different teams or areas of expertise.", example: "On my last project I led a cross-functional group of {field} and engineering students." },
      { term: "stakeholder alignment", partOfSpeech: "noun", definition: "Getting everyone with an interest in a project to agree on its goals.", example: "Early stakeholder alignment saved us weeks of rework later in the project." },
      { term: "measurable impact", partOfSpeech: "noun", definition: "A result you can show with numbers or clear evidence.", example: "I like to talk about measurable impact, so here's what changed after my work." },
      { term: "ownership", partOfSpeech: "noun", definition: "Taking full responsibility for a task and its results.", example: "I took ownership of the project when the lead left, and we still delivered on time." },
    ],
  },
  {
    match: /employee|staff|team member|direct report|workforce/i,
    terms: [
      { term: "psychological safety", partOfSpeech: "noun", definition: "A shared feeling that it is safe to speak up, ask questions and admit mistakes.", example: "I want this team to have psychological safety, so please bring problems to me early." },
      { term: "feedback loop", partOfSpeech: "noun", definition: "A regular cycle of sharing results and responses so things keep improving.", example: "Let's build a quick feedback loop: a short check-in every Friday." },
      { term: "recognition", partOfSpeech: "noun", definition: "Publicly noticing and appreciating someone's work.", example: "Recognition matters to me, so I call out great work in our weekly meeting." },
    ],
  },
  {
    match: /famil|patient|caregiver|relative|parent/i,
    terms: [
      { term: "plan of care", partOfSpeech: "noun", definition: "The agreed set of treatments and goals for a patient's care.", example: "I'll walk you through her plan of care so you know what each day will look like." },
      { term: "family-centered care", partOfSpeech: "noun", definition: "Care that treats the family as partners in decisions about a patient.", example: "We practice family-centered care here, so your questions and input are part of every decision." },
      { term: "comfort measures", partOfSpeech: "noun", definition: "Care focused on easing pain and distress rather than curing illness.", example: "Right now we're focusing on comfort measures to keep him calm and free of pain." },
      { term: "advance directive", partOfSpeech: "noun", definition: "A legal document that states a person's wishes for medical care if they can't speak for themselves.", example: "Does your mother have an advance directive? It helps us follow her wishes." },
    ],
  },
  {
    match: /client|customer/i,
    terms: [
      { term: "deliverable", partOfSpeech: "noun", definition: "A specific piece of work promised to a client by a set date.", example: "The first deliverable will be a one-page summary by Friday." },
      { term: "scope", partOfSpeech: "noun", definition: "The agreed boundaries of what a project will and won't include.", example: "That's a great idea, but it's outside our current scope. Shall we add it to phase two?" },
      { term: "managing expectations", partOfSpeech: "phrase", definition: "Being clear and honest about what will happen, and when.", example: "Managing expectations early means you won't be surprised by the timeline." },
    ],
  },
  {
    match: /executive|leader|board|director|c-suite|senior management/i,
    terms: [
      { term: "bottom line", partOfSpeech: "noun", definition: "The final result that matters most, often profit.", example: "The bottom line is that this change saves two hours per person every week." },
      { term: "strategic priority", partOfSpeech: "noun", definition: "A goal leadership has decided is most important right now.", example: "This supports our strategic priority of keeping new customers past their first month." },
      { term: "executive summary", partOfSpeech: "noun", definition: "A short overview at the start of a report with the key points and recommendation.", example: "I'll start with a one-minute executive summary, then the details if you want them." },
    ],
  },
  {
    match: /professor|academic|faculty|teacher|admissions|committee/i,
    terms: [
      { term: "methodology", partOfSpeech: "noun", definition: "The system of methods used to carry out research.", example: "I chose a mixed-methods methodology so I could pair survey numbers with interviews." },
      { term: "literature review", partOfSpeech: "noun", definition: "A summary and evaluation of existing research on a topic.", example: "My literature review showed a clear gap in how {field} studies measure long-term outcomes." },
      { term: "hypothesis", partOfSpeech: "noun", definition: "A testable prediction about what you expect to find.", example: "My hypothesis was that shorter sessions would improve recall." },
    ],
  },
  {
    match: /team|colleague|peer|coworker|co-worker/i,
    terms: [
      { term: "handoff", partOfSpeech: "noun", definition: "Passing work, with the context needed, from one person to another.", example: "I'll write up a clean handoff so you have everything you need tomorrow." },
      { term: "bandwidth", partOfSpeech: "noun", definition: "Informal: how much time or capacity someone has for more work.", example: "Do you have the bandwidth to review this today, or should I ask someone else?" },
      { term: "blocker", partOfSpeech: "noun", definition: "Something that stops work from moving forward.", example: "My only blocker right now is access to the shared drive." },
    ],
  },
];

/** Used when the field doesn't match any bank above. */
export const MOCK_GENERIC_FIELD: MockEntry[] = [
  { term: "best practice", partOfSpeech: "noun", definition: "A method widely accepted as the most effective way of doing something.", example: "I follow best practice in {field}, but I also check whether it fits each situation." },
  { term: "case study", partOfSpeech: "noun", definition: "A detailed look at one real example, used to learn lessons from it.", example: "One case study from my {field} coursework changed how I approach problems." },
  { term: "industry standard", partOfSpeech: "noun", definition: "A method, tool or level of quality that is normal across a field.", example: "I learned the industry standard tools for {field} in my last role." },
  { term: "subject-matter expert", partOfSpeech: "noun", definition: "A person with deep knowledge of a specific topic.", example: "I worked closely with a subject-matter expert in {field} to check my work." },
  { term: "quality assurance", partOfSpeech: "noun", definition: "Checking work systematically to make sure it meets a standard.", example: "I added a quality assurance step that caught errors before they reached {audience}." },
  { term: "continuing education", partOfSpeech: "noun", definition: "Ongoing learning that keeps professionals up to date in their field.", example: "I keep up with {field} through continuing education courses every year." },
];

export const MOCK_GENERIC_AUDIENCE: MockEntry[] = [
  { term: "active listening", partOfSpeech: "noun", definition: "Fully concentrating on, understanding and responding to what someone says.", example: "Active listening helps me understand what {audience} actually need." },
  { term: "rapport", partOfSpeech: "noun", definition: "A friendly relationship built on mutual understanding.", example: "I build rapport with {audience} by following up on what they told me last time." },
  { term: "clarity", partOfSpeech: "noun", definition: "The quality of being easy to understand.", example: "When I speak with {audience}, I aim for clarity over detail." },
];
