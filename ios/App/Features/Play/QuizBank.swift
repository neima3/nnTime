import Foundation

// Transcribed from src/lib/games.ts (QUIZ_TOPIC_LABELS, GRAMMAR_BANK, SPELLING_BANK).
// Keep in sync with the web banks when questions change.
struct QuizItem: Equatable {
    let topic: String
    let prompt: String
    let options: [String]
    let answer: String
    let note: String
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
        QuizItem(topic: "homophones", prompt: "___ going to love this timeline.", options: ["Your", "You're"], answer: "You're", note: "You're = you are. Your = it belongs to you."),
        QuizItem(topic: "homophones", prompt: "___ meeting starts in five minutes.", options: ["They're", "Their", "There"], answer: "Their", note: "Their = belongs to them. There = a place. They're = they are."),
        QuizItem(topic: "homophones", prompt: "We planned more breaks ___ we actually took.", options: ["then", "than"], answer: "than", note: "Than compares. Then is about time."),
        QuizItem(topic: "homophones", prompt: "Coffee has a strong ___ on my morning plans.", options: ["affect", "effect"], answer: "effect", note: "Effect is (usually) the noun; affect is the verb."),
        QuizItem(topic: "homophones", prompt: "Don't ___ your keys again — put them in the bowl.", options: ["loose", "lose"], answer: "lose", note: "Lose = misplace. Loose = not tight. One o of difference."),
        QuizItem(topic: "homophones", prompt: "I'm ___ tired to argue about semicolons.", options: ["to", "too", "two"], answer: "too", note: "Too = also / excessively. To = direction. Two = 2."),
        QuizItem(topic: "homophones", prompt: "I walked ___ the old library on my way home.", options: ["passed", "past"], answer: "past", note: "Past = beyond (place/time). Passed = the verb pass, done."),
        QuizItem(topic: "homophones", prompt: "Time ___ faster during hyperfocus.", options: ["passed", "past"], answer: "passed", note: "Here it's the verb: time passes, time passed."),
        QuizItem(topic: "homophones", prompt: "I can't decide ___ to nap or to snack.", options: ["weather", "whether"], answer: "whether", note: "Whether = choice. Weather = rain and sunshine."),
        QuizItem(topic: "homophones", prompt: "Ice cream after a hard day is a just ___.", options: ["desert", "dessert"], answer: "dessert", note: "Dessert has two s's — you always want seconds."),
        QuizItem(topic: "homophones", prompt: "Please ___ before the stop sign.", options: ["brake", "break"], answer: "brake", note: "Brake stops the car. Break is what you take at 3pm."),
        QuizItem(topic: "homophones", prompt: "Reading ___ is allowed in the quiet car. Wait—", options: ["aloud", "allowed"], answer: "aloud", note: "Aloud = out loud. Allowed = permitted."),
        QuizItem(topic: "homophones", prompt: "That scarf really ___ your eyes.", options: ["complements", "compliments"], answer: "complements", note: "Complement completes. Compliment flatters."),
        QuizItem(topic: "homophones", prompt: "The ___ of the school knew everyone's name.", options: ["principal", "principle"], answer: "principal", note: "The principal is your pal (allegedly). A principle is a rule."),
        QuizItem(topic: "homophones", prompt: "The car stayed ___ while the light was red.", options: ["stationary", "stationery"], answer: "stationary", note: "StationAry = not moving. StationEry = envelopes (e for envelope)."),
        QuizItem(topic: "homophones", prompt: "A quiet morning brings a rare peace of ___.", options: ["mind", "mine"], answer: "mind", note: "Peace of mind — your mind, at peace. (Piece of cake is the other one.)"),

        // -- apostrophes & ownership --
        QuizItem(topic: "apostrophes", prompt: "The cat licked ___ paw and judged us all.", options: ["its", "it's"], answer: "its", note: "It's = it is. The cat owns the paw, so: its."),
        QuizItem(topic: "apostrophes", prompt: "___ turn is it to water the plant?", options: ["Whose", "Who's"], answer: "Whose", note: "Who's = who is. Whose owns things."),
        QuizItem(topic: "apostrophes", prompt: "The ___ toys are everywhere.", options: ["dogs'", "dog's", "dogs"], answer: "dogs'", note: "Several dogs own the toys → apostrophe after the s: dogs'."),
        QuizItem(topic: "apostrophes", prompt: "Music from the ___ still slaps.", options: ["1990s", "1990's"], answer: "1990s", note: "Decades are plain plurals: the 1990s. No apostrophe needed."),
        QuizItem(topic: "apostrophes", prompt: "That backpack is ___.", options: ["hers", "her's"], answer: "hers", note: "Hers, ours, yours, theirs — possessive pronouns never take apostrophes."),
        QuizItem(topic: "apostrophes", prompt: "___ been a long week already.", options: ["Its", "It's"], answer: "It's", note: "It's = it is / it has. This one is 'it has been' — apostrophe earned."),

        // -- matching up (agreement) --
        QuizItem(topic: "agreement", prompt: "The plan ___ fine until lunch happened.", options: ["was", "were"], answer: "was", note: "One plan → was. Plural things → were."),
        QuizItem(topic: "agreement", prompt: "Neither of the timers ___ set.", options: ["was", "were"], answer: "was", note: "Neither is singular at heart — neither one was set."),
        QuizItem(topic: "agreement", prompt: "Each of the steps ___ five minutes.", options: ["takes", "take"], answer: "takes", note: "Each = one at a time → singular verb. Each one takes."),
        QuizItem(topic: "agreement", prompt: "There ___ three snacks left in the drawer.", options: ["is", "are"], answer: "are", note: "Three snacks are. Flip it: 'three snacks are there.'"),
        QuizItem(topic: "agreement", prompt: "A list of tasks ___ waiting in the inbox.", options: ["is", "are"], answer: "is", note: "The LIST is waiting (one list) — 'of tasks' is just decoration."),
        QuizItem(topic: "agreement", prompt: "Everyone on both teams ___ trying their best.", options: ["is", "are"], answer: "is", note: "Everyone is singular, always — even in a crowd."),
        QuizItem(topic: "agreement", prompt: "The pair of scissors ___ missing again.", options: ["is", "are"], answer: "is", note: "The pair is one thing (even with two blades)."),

        // -- pronouns --
        QuizItem(topic: "pronouns", prompt: "Between you and ___, this app gets me.", options: ["me", "I"], answer: "me", note: "After a preposition (between), it's me. Fancy ≠ correct."),
        QuizItem(topic: "pronouns", prompt: "The snacks are for ___ finishes their review.", options: ["whoever", "whomever"], answer: "whoever", note: "Whoever does the finishing — subjects get whoever."),
        QuizItem(topic: "pronouns", prompt: "My friend and ___ built a pillow fort.", options: ["I", "me", "myself"], answer: "I", note: "Drop the friend: 'I built a fort.' Subjects get I."),
        QuizItem(topic: "pronouns", prompt: "They saved seats for Sam and ___.", options: ["I", "me", "myself"], answer: "me", note: "Drop Sam: 'they saved a seat for me.' Objects get me."),
        QuizItem(topic: "pronouns", prompt: "___ should I say is calling?", options: ["Who", "Whom"], answer: "Who", note: "Who is doing the calling → who. (Whom = him test: 'him is calling'? No.)"),
        QuizItem(topic: "pronouns", prompt: "To ___ should I address this very formal letter?", options: ["who", "whom"], answer: "whom", note: "To him → to whom. The him-test works every time."),
        QuizItem(topic: "pronouns", prompt: "I fixed it ___ — no tutorial needed.", options: ["myself", "meself", "my own self"], answer: "myself", note: "Myself is for emphasis or reflexives — and this one's earned."),

        // -- comparisons --
        QuizItem(topic: "comparisons", prompt: "She did ___ on the exam than she expected.", options: ["better", "more better"], answer: "better", note: "Better is already the comparison — it flies solo."),
        QuizItem(topic: "comparisons", prompt: "The express lane: ten items or ___.", options: ["fewer", "less"], answer: "fewer", note: "Fewer for things you can count. Less for stuff you can't (less time, fewer minutes)."),
        QuizItem(topic: "comparisons", prompt: "I have ___ energy after lunch than before.", options: ["fewer", "less"], answer: "less", note: "Energy isn't countable → less energy. (Fewer naps, less sleep.)"),
        QuizItem(topic: "comparisons", prompt: "How much ___ is the trailhead?", options: ["farther", "further"], answer: "farther", note: "Farther = physical distance. Further = more of anything else."),
        QuizItem(topic: "comparisons", prompt: "Let's discuss this ___ after snacks.", options: ["farther", "further"], answer: "further", note: "Ideas go further; roads go farther."),
        QuizItem(topic: "comparisons", prompt: "The focus timer works really ___.", options: ["good", "well"], answer: "well", note: "Things work well (adverb). The result can be good (adjective)."),
        QuizItem(topic: "comparisons", prompt: "Of the two routes, this one is ___.", options: ["shorter", "shortest"], answer: "shorter", note: "Two things → -er. Three or more → -est."),

        // -- tricky verb pairs --
        QuizItem(topic: "verb-pairs", prompt: "I'm going to ___ down for ten minutes.", options: ["lie", "lay"], answer: "lie", note: "You lie down yourself; you lay something else down. (Lay needs an object.)"),
        QuizItem(topic: "verb-pairs", prompt: "___ the blanket on the couch, please.", options: ["Lie", "Lay"], answer: "Lay", note: "Laying the blanket — lay takes an object."),
        QuizItem(topic: "verb-pairs", prompt: "Can I ___ your charger until lunch?", options: ["borrow", "lend"], answer: "borrow", note: "You borrow FROM someone; they lend TO you."),
        QuizItem(topic: "verb-pairs", prompt: "Could you ___ me five minutes of quiet?", options: ["borrow", "lend"], answer: "lend", note: "They give it → lend. You take it → borrow."),
        QuizItem(topic: "verb-pairs", prompt: "___ the timer for twenty minutes.", options: ["Sit", "Set"], answer: "Set", note: "You set things down/up; you sit yourself."),
        QuizItem(topic: "verb-pairs", prompt: "Bread ___ when the yeast wakes up.", options: ["rises", "raises"], answer: "rises", note: "Things rise on their own; you raise something else."),
        QuizItem(topic: "verb-pairs", prompt: "___ your snacks when you come over.", options: ["Bring", "Take"], answer: "Bring", note: "Bring = toward the speaker. Take = away. Come here and bring snacks."),

        // -- past tense & participles --
        QuizItem(topic: "tense", prompt: "I ___ have gone to bed earlier.", options: ["should of", "should have"], answer: "should have", note: "\"Should of\" is \"should've\" playing dress-up. It's should have."),
        QuizItem(topic: "tense", prompt: "I've ___ that movie three times this week.", options: ["saw", "seen"], answer: "seen", note: "With have/has: seen. Alone: saw. (I saw it; I have seen it.)"),
        QuizItem(topic: "tense", prompt: "She has ___ to that cafe every day this week.", options: ["went", "gone"], answer: "gone", note: "With have/has: gone. Went stands alone. (She went; she has gone.)"),
        QuizItem(topic: "tense", prompt: "The timer had already ___ when I looked up.", options: ["rang", "rung"], answer: "rung", note: "Ring, rang, (has/had) rung — the u shows up with had."),
        QuizItem(topic: "tense", prompt: "I ___ my water bottle somewhere in this house.", options: ["should have left", "should have leaved"], answer: "should have left", note: "Leave, left, left. 'Leaved' only happens to trees, and not even then."),
        QuizItem(topic: "tense", prompt: "We had ___ our best plans by 9 a.m.", options: ["abandoned", "abandonded"], answer: "abandoned", note: "Just one -ed. (Also: relatable.)"),

        // -- word choice --
        QuizItem(topic: "word-choice", prompt: "___ a nap change everything? Absolutely.", options: ["Can", "May"], answer: "Can", note: "Can = ability. May = permission. Naps need no permission."),
        QuizItem(topic: "word-choice", prompt: "Bring a snack — ___, something chocolatey.", options: ["e.g.", "i.e."], answer: "e.g.", note: "e.g. = for example. i.e. = that is (an exact restatement)."),
        QuizItem(topic: "word-choice", prompt: "I water the plants ___ — it's my anchor habit.", options: ["everyday", "every day"], answer: "every day", note: "Every day = each day. Everyday = ordinary ('everyday shoes')."),
        QuizItem(topic: "word-choice", prompt: "That took ___ of courage.", options: ["alot", "a lot", "allot"], answer: "a lot", note: "A lot is two words. Allot means to portion out. Alot is a mythical creature."),
        QuizItem(topic: "word-choice", prompt: "Split the dessert ___ the three of us.", options: ["between", "among"], answer: "among", note: "Between two; among three or more."),
        QuizItem(topic: "word-choice", prompt: "The ___ of steps doesn't matter — starting does.", options: ["amount", "number"], answer: "number", note: "Number for countables (steps); amount for stuff (effort)."),
        QuizItem(topic: "word-choice", prompt: "Turn your to-dos ___ time blocks.", options: ["into", "in to"], answer: "into", note: "Into = transformation/entering. 'In to' is two separate jobs ('log in to the app')."),

        // -- double negatives --
        QuizItem(topic: "negation", prompt: "I can ___ believe the week is over.", options: ["hardly", "not hardly"], answer: "hardly", note: "Hardly is already negative — it works alone."),
        QuizItem(topic: "negation", prompt: "I couldn't care ___ about perfect handwriting.", options: ["less", "fewer"], answer: "less", note: "Couldn't care less = zero care left. ('Could care less' means you still do!)"),
        QuizItem(topic: "negation", prompt: "We didn't do ___ wrong.", options: ["anything", "nothing"], answer: "anything", note: "Didn't + nothing cancels out. One negative per sentence does the job."),
    ]

    static let spelling: [QuizItem] = [
        QuizItem(topic: "spelling", prompt: "It will ___ happen. Probably today.", options: ["definitely", "definately", "definitly"], answer: "definitely", note: "Finite lives inside definitely."),
        QuizItem(topic: "spelling", prompt: "Let's keep work and rest ___.", options: ["seperate", "separate", "seperete"], answer: "separate", note: "There's a rat in separate."),
        QuizItem(topic: "spelling", prompt: "Did you ___ my message?", options: ["recieve", "receive", "receeve"], answer: "receive", note: "I before E… except after C — this is the exception's home."),
        QuizItem(topic: "spelling", prompt: "Rest is ___, not optional.", options: ["necessary", "neccessary", "necesary"], answer: "necessary", note: "One collar (c), two sleeves (s)."),
        QuizItem(topic: "spelling", prompt: "The hotel can ___ late arrivals.", options: ["accomodate", "accommodate", "acommodate"], answer: "accommodate", note: "Accommodate is roomy: two c's AND two m's."),
        QuizItem(topic: "spelling", prompt: "Don't let one typo ___ you.", options: ["embarass", "embarrass", "embaress"], answer: "embarrass", note: "Two r's, two s's — fully flustered."),
        QuizItem(topic: "spelling", prompt: "Deep focus is a rare ___.", options: ["occurence", "occurrence", "occurance"], answer: "occurrence", note: "Double c, double r — it happens a lot in this word."),
        QuizItem(topic: "spelling", prompt: "Drums keep the ___ steady.", options: ["rythm", "rhythm", "rhythem"], answer: "rhythm", note: "Rhythm Helps Your Two Hips Move."),
        QuizItem(topic: "spelling", prompt: "Sleep is a ___, guard it.", options: ["privilege", "priviledge", "privelege"], answer: "privilege", note: "No d — privilege travels light."),
        QuizItem(topic: "spelling", prompt: "Check the ___ before promising anything.", options: ["calender", "calendar", "calandar"], answer: "calendar", note: "It ends like \"radar\": -ar."),
        QuizItem(topic: "spelling", prompt: "That dream was genuinely ___.", options: ["wierd", "weird", "weerd"], answer: "weird", note: "Weird is weird — it breaks the i-before-e rule on purpose."),
        QuizItem(topic: "spelling", prompt: "New week, new ___ to try again.", options: ["oppurtunity", "opportunity", "opportunaty"], answer: "opportunity", note: "Two p's up front, like a running start."),
        QuizItem(topic: "spelling", prompt: "Small steps, big ___.", options: ["achievment", "achievement", "acheivement"], answer: "achievement", note: "Achieve keeps its e before -ment."),
        QuizItem(topic: "spelling", prompt: "Trust the ___ of your routine.", options: ["maintenence", "maintenance", "maintainance"], answer: "maintenance", note: "Main + ten + ance. The ten is the tricky bit."),
        QuizItem(topic: "spelling", prompt: "A quiet morning is my favorite ___.", options: ["enviroment", "environment", "enviornment"], answer: "environment", note: "There's iron in environment."),
        QuizItem(topic: "spelling", prompt: "We started at the ___.", options: ["begining", "beginning", "beggining"], answer: "beginning", note: "Begin doubles its n when it keeps going."),
    ]
}
