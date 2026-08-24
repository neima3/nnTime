import Foundation

// GENERATED FILE — do not edit by hand.
// Source of truth: src/lib/games.ts (QUIZ_TOPIC_LABELS, GRAMMAR_BANK,
// SPELLING_BANK). Regenerate with `pnpm quiz:sync-ios`; drift fails
// tests/ios-quiz-bank-sync.test.ts.

struct QuizExample: Equatable {
    let word: String
    let sample: String
}

struct QuizItem: Equatable {
    let topic: String
    let prompt: String
    let options: [String]
    let answer: String
    let note: String
    var examples: [QuizExample] = []
    var stress: String? = nil
}

enum QuizBank {
    static let topicLabels: [String: String] = [
        "homophones": "sound-alikes",
        "apostrophes": "apostrophes",
        "agreement": "matching up",
        "pronouns": "pronouns",
        "comparisons": "comparisons",
        "verb-pairs": "tricky verbs",
        "tense": "past tense",
        "word-choice": "word choice",
        "negation": "double negatives",
        "spelling": "spelling",
    ]

    static let grammar: [QuizItem] = [
        // -- sound-alikes (homophones) --
        QuizItem(
            topic: "homophones",
            prompt: "___ going to love this timeline.",
            options: ["Your", "You're"],
            answer: "You're",
            note: "You're = you are. Your = it belongs to you.",
            examples: [
                QuizExample(word: "You're", sample: "You're going to crush today."),
                QuizExample(word: "Your", sample: "Your playlist is elite.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "___ meeting starts in five minutes.",
            options: ["They're", "Their", "There"],
            answer: "Their",
            note: "Their = belongs to them. There = a place. They're = they are.",
            examples: [
                QuizExample(word: "Their", sample: "Their dog runs the house."),
                QuizExample(word: "There", sample: "The keys are over there."),
                QuizExample(word: "They're", sample: "They're already on the bus.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "We planned more breaks ___ we actually took.",
            options: ["then", "than"],
            answer: "than",
            note: "Than compares. Then is about time.",
            examples: [
                QuizExample(word: "than", sample: "Taller than a giraffe."),
                QuizExample(word: "then", sample: "First coffee, then everything else.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Coffee has a strong ___ on my morning plans.",
            options: ["affect", "effect"],
            answer: "effect",
            note: "Effect is (usually) the noun; affect is the verb.",
            examples: [
                QuizExample(word: "effect", sample: "The nap had a magical effect."),
                QuizExample(word: "affect", sample: "Rain doesn't affect my plans.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Don't ___ your keys again — put them in the bowl.",
            options: ["loose", "lose"],
            answer: "lose",
            note: "Lose = misplace. Loose = not tight. One o of difference.",
            examples: [
                QuizExample(word: "lose", sample: "Don't lose the remote again."),
                QuizExample(word: "loose", sample: "This screw is a little loose.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "I'm ___ tired to argue about semicolons.",
            options: ["to", "too", "two"],
            answer: "too",
            note: "Too = also / excessively. To = direction. Two = 2.",
            examples: [
                QuizExample(word: "too", sample: "It's too cozy to move."),
                QuizExample(word: "to", sample: "Walk to the window and back."),
                QuizExample(word: "two", sample: "Two snoozes minimum.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "I walked ___ the old library on my way home.",
            options: ["passed", "past"],
            answer: "past",
            note: "Past = beyond (place/time). Passed = the verb pass, done.",
            examples: [
                QuizExample(word: "past", sample: "We drove past the bakery. Twice."),
                QuizExample(word: "passed", sample: "She passed the test easily.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Time ___ faster during hyperfocus.",
            options: ["passed", "past"],
            answer: "passed",
            note: "Here it's the verb: time passes, time passed.",
            examples: [
                QuizExample(word: "passed", sample: "The deadline passed quietly."),
                QuizExample(word: "past", sample: "That's all in the past.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "I can't decide ___ to nap or to snack.",
            options: ["weather", "whether"],
            answer: "whether",
            note: "Whether = choice. Weather = rain and sunshine.",
            examples: [
                QuizExample(word: "whether", sample: "Whether tea or coffee, hydrate."),
                QuizExample(word: "weather", sample: "The weather canceled our picnic.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Ice cream after a hard day is a well-earned ___.",
            options: ["desert", "dessert"],
            answer: "dessert",
            note: "Dessert has two s's — you always want seconds. (The idiom, weirdly, is 'just deserts' — one s.)",
            examples: [
                QuizExample(word: "dessert", sample: "Dessert first is a valid strategy."),
                QuizExample(word: "desert", sample: "Cacti thrive in the desert.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Please ___ before the stop sign.",
            options: ["brake", "break"],
            answer: "brake",
            note: "Brake stops the car. Break is what you take at 3pm.",
            examples: [
                QuizExample(word: "brake", sample: "Tap the brake gently on ice."),
                QuizExample(word: "break", sample: "Take a break — you earned it.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Reading ___ is allowed in the quiet car. Wait—",
            options: ["aloud", "allowed"],
            answer: "aloud",
            note: "Aloud = out loud. Allowed = permitted.",
            examples: [
                QuizExample(word: "aloud", sample: "She read the poem aloud."),
                QuizExample(word: "allowed", sample: "Snacks are allowed in this house.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "That scarf really ___ your eyes.",
            options: ["complements", "compliments"],
            answer: "complements",
            note: "Complement completes. Compliment flatters.",
            examples: [
                QuizExample(word: "complements", sample: "The sauce complements the fries."),
                QuizExample(word: "compliments", sample: "He compliments everyone's handwriting.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "The ___ of the school knew everyone's name.",
            options: ["principal", "principle"],
            answer: "principal",
            note: "The principal is your pal (allegedly). A principle is a rule.",
            examples: [
                QuizExample(word: "principal", sample: "The principal canceled homework. Legend."),
                QuizExample(word: "principle", sample: "Kindness is her guiding principle.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "The car stayed ___ while the light was red.",
            options: ["stationary", "stationery"],
            answer: "stationary",
            note: "StationAry = not moving. StationEry = envelopes (e for envelope).",
            examples: [
                QuizExample(word: "stationary", sample: "The bike is stationary — pedal anyway."),
                QuizExample(word: "stationery", sample: "Fancy stationery makes letters feel royal.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "A quiet morning brings a rare peace of ___.",
            options: ["mind", "mine"],
            answer: "mind",
            note: "Peace of mind — your mind, at peace. (Piece of cake is the other one.)",
            examples: [
                QuizExample(word: "mind", sample: "A slow walk clears my mind."),
                QuizExample(word: "mine", sample: "That cozy blanket is mine.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "I ___ your apology — let's get pancakes.",
            options: ["accept", "except"],
            answer: "accept",
            note: "Accept = take in. Except = leave out. (Ex- exits.)",
            examples: [
                QuizExample(word: "accept", sample: "I accept your cookie offering."),
                QuizExample(word: "except", sample: "Everyone left except the cat.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Take a deep ___ before the next thing.",
            options: ["breath", "breathe"],
            answer: "breath",
            note: "Breath is the noun; breathe (rhymes with seethe) is the verb — the extra e does the exhaling.",
            examples: [
                QuizExample(word: "breath", sample: "Take one slow breath."),
                QuizExample(word: "breathe", sample: "Breathe out longer than in.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "Sacramento is the ___ of California.",
            options: ["capital", "capitol"],
            answer: "capital",
            note: "Capitol with an o is only the building. Every other sense is capital.",
            examples: [
                QuizExample(word: "capital", sample: "Start sentences with a capital letter."),
                QuizExample(word: "capitol", sample: "The capitol dome was gleaming.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "___ split the sky right before the thunder.",
            options: ["Lightning", "Lightening"],
            answer: "Lightning",
            note: "Lightning strikes; lightening means making lighter. The storm has no time for an extra e.",
            examples: [
                QuizExample(word: "Lightning", sample: "Lightning never bothered the ducks."),
                QuizExample(word: "Lightening", sample: "She's lightening her backpack daily.")
            ]),
        QuizItem(
            topic: "homophones",
            prompt: "My ___ is clear. Mostly.",
            options: ["conscience", "conscious"],
            answer: "conscience",
            note: "Conscience = your inner judge. Conscious = awake and aware.",
            examples: [
                QuizExample(word: "conscience", sample: "Her conscience approved the second nap."),
                QuizExample(word: "conscious", sample: "I'm conscious of the time. Barely.")
            ]),
        // -- apostrophes (apostrophes) --
        QuizItem(
            topic: "apostrophes",
            prompt: "The cat licked ___ paw and judged us all.",
            options: ["its", "it's"],
            answer: "its",
            note: "It's = it is. The cat owns the paw, so: its.",
            examples: [
                QuizExample(word: "its", sample: "The plant dropped its last leaf."),
                QuizExample(word: "it's", sample: "It's nap o'clock somewhere.")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "___ turn is it to water the plant?",
            options: ["Whose", "Who's"],
            answer: "Whose",
            note: "Who's = who is. Whose owns things.",
            examples: [
                QuizExample(word: "Whose", sample: "Whose mug is in the sink?"),
                QuizExample(word: "Who's", sample: "Who's bringing the snacks?")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "The two ___ toys are everywhere.",
            options: ["dogs'", "dog's", "dogs"],
            answer: "dogs'",
            note: "Two dogs own the toys → apostrophe after the s: dogs'.",
            examples: [
                QuizExample(word: "dogs'", sample: "The dogs' beds are all occupied."),
                QuizExample(word: "dog's", sample: "One dog's tail knocked the lamp."),
                QuizExample(word: "dogs", sample: "Three dogs, zero regrets.")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "Music from the ___ still slaps.",
            options: ["1990s", "1990's"],
            answer: "1990s",
            note: "Decades are plain plurals: the 1990s. No apostrophe needed.",
            examples: [
                QuizExample(word: "1990s", sample: "The 1990s gave us great cartoons.")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "That backpack is ___.",
            options: ["hers", "her's"],
            answer: "hers",
            note: "Hers, ours, yours, theirs — possessive pronouns never take apostrophes.",
            examples: [
                QuizExample(word: "hers", sample: "The window seat is hers.")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "___ been a long week already.",
            options: ["Its", "It's"],
            answer: "It's",
            note: "It's = it is / it has. This one is 'it has been' — apostrophe earned.",
            examples: [
                QuizExample(word: "It's", sample: "It's been a cozy morning."),
                QuizExample(word: "Its", sample: "The app saved its own settings.")
            ]),
        QuizItem(
            topic: "apostrophes",
            prompt: "Two ___ from now, this is done.",
            options: ["weeks", "week's", "weeks'"],
            answer: "weeks",
            note: "Just a plural — nothing owns anything, so no apostrophe.",
            examples: [
                QuizExample(word: "weeks", sample: "Three weeks flew by."),
                QuizExample(word: "week's", sample: "This week's goal: rest more."),
                QuizExample(word: "weeks'", sample: "Two weeks' notice, politely given.")
            ]),
        // -- matching up (agreement) --
        QuizItem(
            topic: "agreement",
            prompt: "The plan ___ fine until lunch happened.",
            options: ["was", "were"],
            answer: "was",
            note: "One plan → was. Plural things → were.",
            examples: [
                QuizExample(word: "was", sample: "The soup was perfect."),
                QuizExample(word: "were", sample: "The dumplings were even better.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "Neither of the timers ___ set.",
            options: ["was", "were"],
            answer: "was",
            note: "Neither is singular at heart — neither one was set.",
            examples: [
                QuizExample(word: "was", sample: "Neither alarm was loud enough."),
                QuizExample(word: "were", sample: "Both alarms were asleep too.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "Each of the steps ___ five minutes.",
            options: ["takes", "take"],
            answer: "takes",
            note: "Each = one at a time → singular verb. Each one takes.",
            examples: [
                QuizExample(word: "takes", sample: "Each step takes patience."),
                QuizExample(word: "take", sample: "Small steps take you far.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "There ___ three snacks left in the drawer.",
            options: ["is", "are"],
            answer: "are",
            note: "Three snacks are. Flip it: 'three snacks are there.'",
            examples: [
                QuizExample(word: "are", sample: "There are two cookies left."),
                QuizExample(word: "is", sample: "There is one brave carrot.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "A list of tasks ___ waiting in the inbox.",
            options: ["is", "are"],
            answer: "is",
            note: "The LIST is waiting (one list) — 'of tasks' is just decoration.",
            examples: [
                QuizExample(word: "is", sample: "A stack of books is a mood."),
                QuizExample(word: "are", sample: "The books are due Friday.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "Everyone on both teams ___ trying their best.",
            options: ["is", "are"],
            answer: "is",
            note: "Everyone is singular, always — even in a crowd.",
            examples: [
                QuizExample(word: "is", sample: "Everybody is welcome here."),
                QuizExample(word: "are", sample: "All of us are welcome too.")
            ]),
        QuizItem(
            topic: "agreement",
            prompt: "The pair of scissors ___ missing again.",
            options: ["is", "are"],
            answer: "is",
            note: "The pair is one thing (even with two blades).",
            examples: [
                QuizExample(word: "is", sample: "A pair of mittens is enough."),
                QuizExample(word: "are", sample: "The mittens are inseparable.")
            ]),
        // -- pronouns (pronouns) --
        QuizItem(
            topic: "pronouns",
            prompt: "Between you and ___, this app gets me.",
            options: ["me", "I"],
            answer: "me",
            note: "After a preposition (between), it's me. Fancy ≠ correct.",
            examples: [
                QuizExample(word: "me", sample: "Save a seat for me."),
                QuizExample(word: "I", sample: "Sam and I found the fort.")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "The snacks are for ___ finishes their review.",
            options: ["whoever", "whomever"],
            answer: "whoever",
            note: "Whoever does the finishing — subjects get whoever.",
            examples: [
                QuizExample(word: "whoever", sample: "Whoever naps first wins."),
                QuizExample(word: "whomever", sample: "Give the prize to whomever you like.")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "My friend and ___ built a pillow fort.",
            options: ["I", "me", "myself"],
            answer: "I",
            note: "Drop the friend: 'I built a fort.' Subjects get I.",
            examples: [
                QuizExample(word: "I", sample: "Ana and I made pancakes."),
                QuizExample(word: "me", sample: "The pancakes were for me."),
                QuizExample(word: "myself", sample: "I flipped one myself.")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "They saved seats for Sam and ___.",
            options: ["I", "me", "myself"],
            answer: "me",
            note: "Drop Sam: 'they saved a seat for me.' Objects get me.",
            examples: [
                QuizExample(word: "me", sample: "They cheered for Sam and me."),
                QuizExample(word: "I", sample: "Sam and I took a bow."),
                QuizExample(word: "myself", sample: "I surprised even myself.")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "___ should I say is calling?",
            options: ["Who", "Whom"],
            answer: "Who",
            note: "Who is doing the calling → who. (Whom = him test: 'him is calling'? No.)",
            examples: [
                QuizExample(word: "Who", sample: "Who ate the last dumpling?"),
                QuizExample(word: "Whom", sample: "To whom do I owe thanks?")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "To ___ should I address this very formal letter?",
            options: ["who", "whom"],
            answer: "whom",
            note: "To him → to whom. (Run the him-test inside the clause that owns the verb.)",
            examples: [
                QuizExample(word: "whom", sample: "To whom it may concern: hi."),
                QuizExample(word: "who", sample: "Who wrote this lovely note?")
            ]),
        QuizItem(
            topic: "pronouns",
            prompt: "I fixed it ___ — no tutorial needed.",
            options: ["myself", "meself", "my own self"],
            answer: "myself",
            note: "Myself is for emphasis or reflexives — and this one's earned.",
            examples: [
                QuizExample(word: "myself", sample: "I assembled the shelf myself.")
            ]),
        // -- comparisons (comparisons) --
        QuizItem(
            topic: "comparisons",
            prompt: "She did ___ on the exam than she expected.",
            options: ["better", "more better"],
            answer: "better",
            note: "Better is already the comparison — it flies solo.",
            examples: [
                QuizExample(word: "better", sample: "Rested-me plans better than tired-me.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "The express lane: ten items or ___.",
            options: ["fewer", "less"],
            answer: "fewer",
            note: "Fewer counts things; less handles stuff. (Real signs say less — old idiom — but fewer is the tidy pick.)",
            examples: [
                QuizExample(word: "fewer", sample: "Fewer tabs, calmer brain."),
                QuizExample(word: "less", sample: "Less noise, more focus.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "I have ___ energy after lunch than before.",
            options: ["fewer", "less"],
            answer: "less",
            note: "Energy isn't countable → less energy. (Fewer naps, less sleep.)",
            examples: [
                QuizExample(word: "less", sample: "There's less traffic before eight."),
                QuizExample(word: "fewer", sample: "Fewer alarms, gentler mornings.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "This was the ___ day of the whole summer.",
            options: ["hottest", "most hottest"],
            answer: "hottest",
            note: "-est already does the most-work — no double stacking.",
            examples: [
                QuizExample(word: "hottest", sample: "July's hottest day melted the crayons.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "Let's discuss this ___ after snacks.",
            options: ["farther", "further"],
            answer: "further",
            note: "Ideas go further; roads go farther.",
            examples: [
                QuizExample(word: "further", sample: "The rumor went further than intended."),
                QuizExample(word: "farther", sample: "The lake is farther than it looks.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "The focus timer works really ___.",
            options: ["good", "well"],
            answer: "well",
            note: "Things work well (adverb). The result can be good (adjective).",
            examples: [
                QuizExample(word: "well", sample: "The plan worked out well."),
                QuizExample(word: "good", sample: "The result was good.")
            ]),
        QuizItem(
            topic: "comparisons",
            prompt: "Of the two routes, this one is ___.",
            options: ["shorter", "shortest"],
            answer: "shorter",
            note: "Two things → -er. Three or more → -est.",
            examples: [
                QuizExample(word: "shorter", sample: "This queue is shorter than that one."),
                QuizExample(word: "shortest", sample: "Of all three lines, this is shortest.")
            ]),
        // -- tricky verbs (verb-pairs) --
        QuizItem(
            topic: "verb-pairs",
            prompt: "I'm going to ___ down for ten minutes.",
            options: ["lie", "lay"],
            answer: "lie",
            note: "You lie down yourself; you lay something else down. (Lay needs an object.)",
            examples: [
                QuizExample(word: "lie", sample: "I lie down when the timer ends."),
                QuizExample(word: "lay", sample: "Lay the mat by the window.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "___ the blanket on the couch, please.",
            options: ["Lie", "Lay"],
            answer: "Lay",
            note: "Laying the blanket — lay takes an object.",
            examples: [
                QuizExample(word: "Lay", sample: "Lay your worries down gently."),
                QuizExample(word: "Lie", sample: "Lie back and watch the clouds.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "Can I ___ your charger until lunch?",
            options: ["borrow", "lend"],
            answer: "borrow",
            note: "You borrow FROM someone; they lend TO you.",
            examples: [
                QuizExample(word: "borrow", sample: "May I borrow a pencil?"),
                QuizExample(word: "lend", sample: "I'll lend you my lucky one.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "Could you ___ me five minutes of quiet?",
            options: ["borrow", "lend"],
            answer: "lend",
            note: "They give it → lend. You take it → borrow.",
            examples: [
                QuizExample(word: "lend", sample: "Friends lend hoodies forever."),
                QuizExample(word: "borrow", sample: "You can borrow the good pen.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "___ the timer for twenty minutes.",
            options: ["Sit", "Set"],
            answer: "Set",
            note: "You set things down/up; you sit yourself.",
            examples: [
                QuizExample(word: "Set", sample: "Set the mug down slowly."),
                QuizExample(word: "Sit", sample: "Sit wherever the sun lands.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "Bread ___ when the yeast wakes up.",
            options: ["rises", "raises"],
            answer: "rises",
            note: "Things rise on their own; you raise something else.",
            examples: [
                QuizExample(word: "rises", sample: "The moon rises over the lot."),
                QuizExample(word: "raises", sample: "She raises the blinds at noon.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "___ your snacks when you come over.",
            options: ["Bring", "Take"],
            answer: "Bring",
            note: "Bring = toward the speaker. Take = away. Come here and bring snacks.",
            examples: [
                QuizExample(word: "Bring", sample: "Bring your appetite over here."),
                QuizExample(word: "Take", sample: "Take this umbrella when you go.")
            ]),
        QuizItem(
            topic: "verb-pairs",
            prompt: "Could you ___ me that dice trick?",
            options: ["teach", "learn"],
            answer: "teach",
            note: "You teach someone else; you learn for yourself.",
            examples: [
                QuizExample(word: "teach", sample: "Teach me that card trick."),
                QuizExample(word: "learn", sample: "I learn best by doing.")
            ]),
        // -- past tense (tense) --
        QuizItem(
            topic: "tense",
            prompt: "I ___ gone to bed earlier.",
            options: ["should of", "should have"],
            answer: "should have",
            note: "\"Should of\" is \"should've\" playing dress-up. It's should have.",
            examples: [
                QuizExample(word: "should have", sample: "I should have stretched first.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "I've ___ that movie three times this week.",
            options: ["saw", "seen"],
            answer: "seen",
            note: "With have/has: seen. Alone: saw. (I saw it; I have seen it.)",
            examples: [
                QuizExample(word: "seen", sample: "I've seen this twist before."),
                QuizExample(word: "saw", sample: "I saw it coming anyway.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "She has ___ to that cafe every day this week.",
            options: ["went", "gone"],
            answer: "gone",
            note: "With have/has: gone. Went stands alone. (She went; she has gone.)",
            examples: [
                QuizExample(word: "gone", sample: "She has gone full cozy mode."),
                QuizExample(word: "went", sample: "She went to bed at nine.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "The timer had already ___ when I looked up.",
            options: ["rang", "rung"],
            answer: "rung",
            note: "Ring, rang, (has/had) rung — the u shows up with had.",
            examples: [
                QuizExample(word: "rung", sample: "The bell had rung twice."),
                QuizExample(word: "rang", sample: "The bell rang at noon.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "I ___ my water bottle somewhere in this house.",
            options: ["must have left", "must have leaved"],
            answer: "must have left",
            note: "Leave, left, left. 'Leaved' only happens to trees, and not even then.",
            examples: [
                QuizExample(word: "must have left", sample: "I must have left it in the car.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "We had ___ our best plans by 9 a.m.",
            options: ["abandoned", "abandonded"],
            answer: "abandoned",
            note: "Just one -ed. (Also: relatable.)",
            examples: [
                QuizExample(word: "abandoned", sample: "We abandoned the spreadsheet, not the dream.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "She had ___ all the cocoa by nine.",
            options: ["drunk", "drank"],
            answer: "drunk",
            note: "Drink, drank, (has/had) drunk — the u arrives with have/had.",
            examples: [
                QuizExample(word: "drunk", sample: "We had drunk the whole pot."),
                QuizExample(word: "drank", sample: "I drank mine too fast.")
            ]),
        QuizItem(
            topic: "tense",
            prompt: "Yesterday I ___ rest, and it was correct.",
            options: ["chose", "choose"],
            answer: "chose",
            note: "Choose (oo) is now; chose (one o) already happened.",
            examples: [
                QuizExample(word: "chose", sample: "Yesterday I chose the couch."),
                QuizExample(word: "choose", sample: "Today I choose the trail.")
            ]),
        // -- word choice (word-choice) --
        QuizItem(
            topic: "word-choice",
            prompt: "___ a nap change everything? Absolutely.",
            options: ["Can", "May"],
            answer: "Can",
            note: "Can = ability. May = permission. Naps need no permission.",
            examples: [
                QuizExample(word: "Can", sample: "Can she juggle? Absolutely."),
                QuizExample(word: "May", sample: "May I open a window?")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "Bring a snack — ___, trail mix or something chocolatey.",
            options: ["e.g.", "i.e."],
            answer: "e.g.",
            note: "e.g. = for example. i.e. = that is (an exact restatement).",
            examples: [
                QuizExample(word: "e.g.", sample: "Pack layers, e.g., a hoodie."),
                QuizExample(word: "i.e.", sample: "The demo starts at noon — i.e., in twenty minutes.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "I water the plants ___ — it's my anchor habit.",
            options: ["everyday", "every day"],
            answer: "every day",
            note: "Every day = each day. Everyday = ordinary ('everyday shoes').",
            examples: [
                QuizExample(word: "every day", sample: "I stretch every day at three."),
                QuizExample(word: "everyday", sample: "These are my everyday sneakers.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "That took ___ of courage.",
            options: ["alot", "a lot", "allot"],
            answer: "a lot",
            note: "A lot is two words. Allot means to portion out. Alot is a mythical creature.",
            examples: [
                QuizExample(word: "a lot", sample: "That took a lot of nerve."),
                QuizExample(word: "allot", sample: "Allot ten minutes for tidying.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "The rumor spread ___ the wedding guests.",
            options: ["between", "among"],
            answer: "among",
            note: "Among for a group as a whole; between for pairs and one-on-one deals.",
            examples: [
                QuizExample(word: "among", sample: "Calm settled among the hikers."),
                QuizExample(word: "between", sample: "Split the fries between us two.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "The ___ of steps doesn't matter — starting does.",
            options: ["amount", "number"],
            answer: "number",
            note: "Number for countables (steps); amount for stuff (effort).",
            examples: [
                QuizExample(word: "number", sample: "The number of ducks doubled."),
                QuizExample(word: "amount", sample: "The amount of joy: immense.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "Turn your to-dos ___ time blocks.",
            options: ["into", "in to"],
            answer: "into",
            note: "Into = transformation/entering. 'In to' is two separate jobs ('log in to the app').",
            examples: [
                QuizExample(word: "into", sample: "She turned leftovers into lunch."),
                QuizExample(word: "in to", sample: "Log in to see your streak.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "Thanks for the ___ — I'll take it this time.",
            options: ["advice", "advise"],
            answer: "advice",
            note: "Advice (sounds like ice) is the thing; advise (sounds like eyes) is the doing.",
            examples: [
                QuizExample(word: "advice", sample: "Her advice: nap first, decide later."),
                QuizExample(word: "advise", sample: "I advise starting tiny.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "The library was ___ except for one loud keyboard.",
            options: ["quiet", "quite"],
            answer: "quiet",
            note: "Quiet = hush (two syllables). Quite = very. The e placement does all the work.",
            examples: [
                QuizExample(word: "quiet", sample: "The park stayed blissfully quiet."),
                QuizExample(word: "quite", sample: "That plan is quite ambitious.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "Please ___ the oven is actually off.",
            options: ["ensure", "insure"],
            answer: "ensure",
            note: "Ensure = make certain. Insure is best saved for policies and premiums.",
            examples: [
                QuizExample(word: "ensure", sample: "Ensure the door clicks shut."),
                QuizExample(word: "insure", sample: "You can insure the tuba.")
            ]),
        QuizItem(
            topic: "word-choice",
            prompt: "I didn't mean to ___ you took the last slice.",
            options: ["imply", "infer"],
            answer: "imply",
            note: "Speakers imply (send the hint); listeners infer (catch it).",
            examples: [
                QuizExample(word: "imply", sample: "I didn't mean to imply that."),
                QuizExample(word: "infer", sample: "From the crumbs, I infer cookies.")
            ]),
        // -- double negatives (negation) --
        QuizItem(
            topic: "negation",
            prompt: "I can ___ believe the week is over.",
            options: ["hardly", "not hardly"],
            answer: "hardly",
            note: "Hardly is already negative — it works alone.",
            examples: [
                QuizExample(word: "hardly", sample: "I can hardly wait for Friday.")
            ]),
        QuizItem(
            topic: "negation",
            prompt: "I couldn't care ___ about perfect handwriting.",
            options: ["less", "fewer"],
            answer: "less",
            note: "Couldn't care less = zero care left. ('Could care less' means you still do!)",
            examples: [
                QuizExample(word: "less", sample: "There's less drama in comfy pants."),
                QuizExample(word: "fewer", sample: "Fewer meetings, more meandering.")
            ]),
        QuizItem(
            topic: "negation",
            prompt: "We didn't do ___ wrong.",
            options: ["anything", "nothing"],
            answer: "anything",
            note: "Didn't + nothing cancels out. One negative per sentence does the job.",
            examples: [
                QuizExample(word: "anything", sample: "We didn't break anything important."),
                QuizExample(word: "nothing", sample: "Nothing beats a quiet morning.")
            ]),
        QuizItem(
            topic: "negation",
            prompt: "Nobody said ___ about a pop quiz.",
            options: ["anything", "nothing"],
            answer: "anything",
            note: "Nobody already brings the negative — anything keeps the sentence single-negative.",
            examples: [
                QuizExample(word: "anything", sample: "She didn't say anything about cake."),
                QuizExample(word: "nothing", sample: "Nothing says Friday like pancakes.")
            ]),
    ]

    static let spelling: [QuizItem] = [
        // -- spelling (spelling) --
        QuizItem(
            topic: "spelling",
            prompt: "It will ___ happen. Probably today.",
            options: ["definitely", "definately", "definitly"],
            answer: "definitely",
            note: "Finite lives inside definitely.",
            stress: "finite"),
        QuizItem(
            topic: "spelling",
            prompt: "Let's keep work and rest ___.",
            options: ["seperate", "separate", "seperete"],
            answer: "separate",
            note: "There's a rat in separate.",
            stress: "arat"),
        QuizItem(
            topic: "spelling",
            prompt: "Did you ___ my message?",
            options: ["recieve", "receive", "receeve"],
            answer: "receive",
            note: "I before E… except after C — this is the exception's home.",
            stress: "cei"),
        QuizItem(
            topic: "spelling",
            prompt: "Rest is ___, not optional.",
            options: ["necessary", "neccessary", "necesary"],
            answer: "necessary",
            note: "One collar (c), two sleeves (s).",
            stress: "cess"),
        QuizItem(
            topic: "spelling",
            prompt: "The hotel can ___ late arrivals.",
            options: ["accomodate", "accommodate", "acommodate"],
            answer: "accommodate",
            note: "Accommodate is roomy: two c's AND two m's.",
            stress: "ccomm"),
        QuizItem(
            topic: "spelling",
            prompt: "Don't let one typo ___ you.",
            options: ["embarass", "embarrass", "embaress"],
            answer: "embarrass",
            note: "Two r's, two s's — fully flustered.",
            stress: "rrass"),
        QuizItem(
            topic: "spelling",
            prompt: "Deep focus is a rare ___.",
            options: ["occurence", "occurrence", "occurance"],
            answer: "occurrence",
            note: "Double c, double r — it happens a lot in this word.",
            stress: "ccurr"),
        QuizItem(
            topic: "spelling",
            prompt: "Drums keep the ___ steady.",
            options: ["rythm", "rhythm", "rhythem"],
            answer: "rhythm",
            note: "Rhythm Helps Your Two Hips Move.",
            stress: "hyth"),
        QuizItem(
            topic: "spelling",
            prompt: "Sleep is a ___ — guard it.",
            options: ["privilege", "priviledge", "privelege"],
            answer: "privilege",
            note: "No d — privilege travels light.",
            stress: "lege"),
        QuizItem(
            topic: "spelling",
            prompt: "Check the ___ before promising anything.",
            options: ["calender", "calendar", "calandar"],
            answer: "calendar",
            note: "It ends like \"radar\": -ar.",
            stress: "dar"),
        QuizItem(
            topic: "spelling",
            prompt: "That dream was genuinely ___.",
            options: ["wierd", "weird", "weerd"],
            answer: "weird",
            note: "Weird is weird — it breaks the i-before-e rule on purpose.",
            stress: "ei"),
        QuizItem(
            topic: "spelling",
            prompt: "New week, new ___ to try again.",
            options: ["oppurtunity", "opportunity", "opportunaty"],
            answer: "opportunity",
            note: "There's a port in opportunity — opp-OR-tunity, ending in -ity.",
            stress: "port"),
        QuizItem(
            topic: "spelling",
            prompt: "Small steps, big ___.",
            options: ["achievment", "achievement", "acheivement"],
            answer: "achievement",
            note: "Achieve keeps its e before -ment.",
            stress: "eve"),
        QuizItem(
            topic: "spelling",
            prompt: "Trust the ___ of your routine.",
            options: ["maintenence", "maintenance", "maintainance"],
            answer: "maintenance",
            note: "Main + ten + ance. The ten is the tricky bit.",
            stress: "ten"),
        QuizItem(
            topic: "spelling",
            prompt: "A quiet morning is my favorite ___.",
            options: ["enviroment", "environment", "enviornment"],
            answer: "environment",
            note: "There's iron in environment.",
            stress: "iron"),
        QuizItem(
            topic: "spelling",
            prompt: "We started at the ___.",
            options: ["begining", "beginning", "beggining"],
            answer: "beginning",
            note: "Begin doubles its n when it keeps going.",
            stress: "nn"),
        QuizItem(
            topic: "spelling",
            prompt: "Let's try that new ___ on Friday.",
            options: ["restaraunt", "restaurant", "resturant"],
            answer: "restaurant",
            note: "Rest + aura + nt — there's an aura in there.",
            stress: "aura"),
        QuizItem(
            topic: "spelling",
            prompt: "The shortest month is ___.",
            options: ["February", "Febuary", "Febraury"],
            answer: "February",
            note: "Feb-RU-ary — the first r is shy but present.",
            stress: "bru"),
        QuizItem(
            topic: "spelling",
            prompt: "The ___ had forty questions. We answered six.",
            options: ["questionaire", "questionnaire", "questionnair"],
            answer: "questionnaire",
            note: "Question + naire — the n doubles at the seam.",
            stress: "nn"),
        QuizItem(
            topic: "spelling",
            prompt: "The cat looked deeply ___.",
            options: ["mischievous", "mischievious", "mischevious"],
            answer: "mischievous",
            note: "MIS-chie-vous, three syllables — no extra i near the end.",
            stress: "vous"),
        QuizItem(
            topic: "spelling",
            prompt: "Her French ___ is showing off again.",
            options: ["pronounciation", "pronunciation", "pronunceation"],
            answer: "pronunciation",
            note: "You pronounce, but the noun drops that o: pro-nun-ciation.",
            stress: "nun"),
        QuizItem(
            topic: "spelling",
            prompt: "He ___ praised the office plant.",
            options: ["publicley", "publicly", "publicaly"],
            answer: "publicly",
            note: "Public + ly, nothing extra. (The 'publically' you see in the wild is the less-loved variant.)",
            stress: "cly"),
    ]
}
