/**
 * Common interview and reflection questions shown in the Journal's question bank.
 * Edit freely: add a category or questions and they appear automatically.
 */
export const QUESTION_BANK: { category: string; questions: string[] }[] = [
  {
    category: "About you",
    questions: [
      "Tell me about yourself.",
      "How would your friends describe you?",
      "What are you most proud of so far?",
      "What motivates you to do your best work?",
      "What's something you've changed your mind about recently?",
      "What do you do outside of work or school that energizes you?",
      "Walk me through your resume.",
      "What three words best describe you, and why?",
      "What's a value you won't compromise on?",
      "What's something about you that isn't on your resume?",
    ],
  },
  {
    category: "Challenges and growth",
    questions: [
      "What is one time that you struggled?",
      "Tell me about a mistake you made and what you learned from it.",
      "Describe a time you failed. How did you respond?",
      "Tell me about a time you had to learn something quickly.",
      "What's the hardest feedback you've ever received?",
      "Describe a time you were outside your comfort zone.",
      "Tell me about a goal you didn't reach. What happened?",
      "Describe a time you had to adapt to a big change.",
      "When have you had to persevere through a setback?",
      "Tell me about a time you were overwhelmed. How did you handle it?",
      "What's a habit you've worked hard to build or break?",
    ],
  },
  {
    category: "Teamwork",
    questions: [
      "Describe a time you worked on a team to achieve a goal.",
      "Tell me about a time you helped a struggling teammate.",
      "Describe a time you had to rely on others to finish a project.",
      "What role do you usually take on in a group?",
      "Tell me about a time you worked with someone very different from you.",
      "Describe a team project that didn't go well. What would you change?",
      "How do you build trust with new teammates?",
      "Tell me about a time you shared credit for a success.",
      "Describe a time you worked with a remote or distributed team.",
    ],
  },
  {
    category: "Leadership",
    questions: [
      "Tell me about a time you led a project or group.",
      "Describe a time you motivated others.",
      "Tell me about a time you made a decision without all the information.",
      "Describe a time you had to delegate work.",
      "Tell me about a time you took initiative without being asked.",
      "Describe a time you had to make an unpopular decision.",
      "How would you describe your leadership style?",
      "Tell me about a time you mentored or taught someone.",
      "Describe a time you led change in a group or organization.",
    ],
  },
  {
    category: "Conflict",
    questions: [
      "Describe a time you disagreed with a supervisor.",
      "Tell me about a conflict with a coworker and how you resolved it.",
      "Describe a time you had to deliver bad news.",
      "Tell me about a time you dealt with a difficult customer or client.",
      "Describe a time you had to say no to someone.",
      "Tell me about a time someone criticized your work unfairly.",
      "How do you handle disagreement in a group discussion?",
      "Describe a time you changed someone's mind.",
    ],
  },
  {
    category: "Strengths and weaknesses",
    questions: [
      "What is your greatest strength?",
      "What is your greatest weakness?",
      "What skill are you working on improving right now?",
      "What would a past supervisor say you could do better?",
      "What sets you apart from other candidates?",
      "What's a skill you've developed that you didn't expect to?",
      "What kind of work comes easiest to you?",
      "What kind of work do you find most draining?",
    ],
  },
  {
    category: "Problem solving",
    questions: [
      "Describe a complex problem you solved.",
      "Tell me about a time you found a creative solution.",
      "Describe a time you used data to make a decision.",
      "Tell me about a time you spotted a problem before others did.",
      "Describe a time you improved a process.",
      "Tell me about a time you had to work with a tight budget or limited resources.",
      "How do you approach a problem you've never seen before?",
      "Describe a time you had to make a quick decision under pressure.",
    ],
  },
  {
    category: "Time management",
    questions: [
      "Tell me about a time you managed several deadlines at once.",
      "Describe a time you missed a deadline. What happened?",
      "How do you prioritize when everything feels urgent?",
      "Tell me about a time you had to juggle school or work with other commitments.",
      "Describe a long project you kept on track.",
      "How do you stay organized day to day?",
    ],
  },
  {
    category: "Communication",
    questions: [
      "Tell me about a time you explained something complex to a non-expert.",
      "Describe a presentation you're proud of.",
      "Tell me about a time a miscommunication caused a problem.",
      "Describe a time you had to persuade someone.",
      "How do you adjust your communication for different audiences?",
      "Tell me about a time you had to write something important.",
      "Describe a time you had to listen more than you spoke.",
    ],
  },
  {
    category: "Motivation and career goals",
    questions: [
      "Why do you want this job?",
      "Why are you interested in this field?",
      "Where do you see yourself in five years?",
      "What are you looking for in your next role?",
      "Why are you leaving your current position?",
      "What kind of work environment helps you thrive?",
      "What would make you excited to come to work every day?",
      "What does success look like to you?",
      "What do you know about our organization?",
      "Why should we hire you?",
    ],
  },
  {
    category: "Ethics and judgment",
    questions: [
      "Tell me about a time you faced an ethical dilemma.",
      "Describe a time you had to hold yourself accountable.",
      "Tell me about a time you noticed something wrong and spoke up.",
      "Describe a time you had to keep information confidential.",
      "Tell me about a time you chose the harder right over the easier wrong.",
    ],
  },
  {
    category: "Wrapping up",
    questions: [
      "What questions do you have for us?",
      "Is there anything else you'd like us to know about you?",
      "What would your first 90 days look like?",
      "What are your salary expectations?",
      "When could you start?",
    ],
  },
];

export const QUESTION_COUNT = QUESTION_BANK.reduce((n, c) => n + c.questions.length, 0);
