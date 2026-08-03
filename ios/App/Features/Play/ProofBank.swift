import Foundation

// Transcribed from src/lib/games.ts (PROOF_BANK).
// Keep in sync with the web bank when sentences change.
struct ProofItem: Equatable {
    let topic: String
    let text: String
    let errorIndex: Int
    let fix: String
    let note: String
}

enum ProofBank {
    static let sentences: [ProofItem] = [
        // -- sound-alikes --
        ProofItem(topic: "homophones", text: "Their heading to the park after lunch.", errorIndex: 0, fix: "They're", note: "They're = they are. Their owns things; it can't head anywhere."),
        ProofItem(topic: "homophones", text: "Grab you're coat — the rain looks serious.", errorIndex: 1, fix: "your", note: "Your owns the coat. You're = you are."),
        ProofItem(topic: "homophones", text: "The dog wagged it's tail at every stranger.", errorIndex: 3, fix: "its", note: "Its owns the tail. It's always means it is."),
        ProofItem(topic: "homophones", text: "We drove passed the bakery without stopping.", errorIndex: 2, fix: "past", note: "Past = beyond a place. Passed is the verb pass, done."),
        ProofItem(topic: "homophones", text: "This backpack is to heavy for a day hike.", errorIndex: 3, fix: "too", note: "Too = excessively. To points somewhere."),
        ProofItem(topic: "homophones", text: "The news had a big affect on the plan.", errorIndex: 5, fix: "effect", note: "Effect is the noun; affect is (usually) the verb."),
        ProofItem(topic: "homophones", text: "My knew headphones cancel every distraction.", errorIndex: 1, fix: "new", note: "New = not old. Knew is the past of know."),
        ProofItem(topic: "homophones", text: "There car is parked across two spaces.", errorIndex: 0, fix: "Their", note: "Their owns the car. There is a place."),
        ProofItem(topic: "homophones", text: "I can't except another meeting this week.", errorIndex: 2, fix: "accept", note: "Accept = take in. Except = leave out."),
        ProofItem(topic: "homophones", text: "The advise she gave me actually worked.", errorIndex: 1, fix: "advice", note: "Advice is the noun you get; advise is the verb you do."),
        ProofItem(topic: "homophones", text: "Take a peak at the schedule before nine.", errorIndex: 2, fix: "peek", note: "Peek = a quick look. Peak = the top of a mountain."),
        ProofItem(topic: "homophones", text: "The whether ruined our picnic plans again.", errorIndex: 1, fix: "weather", note: "Weather rains on picnics. Whether weighs choices."),
        // -- spelling --
        ProofItem(topic: "spelling", text: "She is definately coming to the party.", errorIndex: 2, fix: "definitely", note: "Definitely has finite inside it — no a anywhere."),
        ProofItem(topic: "spelling", text: "That was a wierd way to end a meeting.", errorIndex: 3, fix: "weird", note: "Weird is weird — it breaks the i-before-e rule."),
        ProofItem(topic: "spelling", text: "Thanks — I really appriciate the reminder.", errorIndex: 4, fix: "appreciate", note: "Appreciate: to get its e's right, think of getting a price."),
        ProofItem(topic: "spelling", text: "Seperate the laundry before you start.", errorIndex: 0, fix: "Separate", note: "There's a rat in separate."),
        ProofItem(topic: "spelling", text: "It happend again right after the reset.", errorIndex: 1, fix: "happened", note: "Happened keeps the full -ened. Happen + ed."),
        ProofItem(topic: "spelling", text: "The enviroment here is great for focus.", errorIndex: 1, fix: "environment", note: "Environment hides iron in the middle: env-iron-ment."),
        ProofItem(topic: "spelling", text: "Tomorow is fully booked with appointments.", errorIndex: 0, fix: "Tomorrow", note: "Tomorrow: one m, two r's. Borrow an r, not an m."),
        ProofItem(topic: "spelling", text: "Which restaraunt did you end up choosing?", errorIndex: 1, fix: "restaurant", note: "Restaurant keeps the French -aur-: rest-au-rant."),
        // -- tense --
        ProofItem(topic: "tense", text: "Yesterday she run the whole loop twice.", errorIndex: 2, fix: "ran", note: "Yesterday pushes run into the past: ran."),
        ProofItem(topic: "tense", text: "He has went home early every day this week.", errorIndex: 2, fix: "gone", note: "After has, go becomes gone. Went stands alone."),
        ProofItem(topic: "tense", text: "We seen that movie at the drive-in.", errorIndex: 1, fix: "saw", note: "Saw stands alone; seen needs a helper (have seen)."),
        ProofItem(topic: "tense", text: "They had already ate when we arrived.", errorIndex: 3, fix: "eaten", note: "After had, eat becomes eaten. Ate stands alone."),
        ProofItem(topic: "tense", text: "I should have wrote that reminder down.", errorIndex: 3, fix: "written", note: "After have, write becomes written. Wrote stands alone."),
        ProofItem(topic: "tense", text: "The package come this morning after all.", errorIndex: 2, fix: "came", note: "This morning is past — come becomes came."),
        // -- agreement --
        ProofItem(topic: "agreement", text: "The list of chores were longer than expected.", errorIndex: 4, fix: "was", note: "The list was long — one list, even with many chores on it."),
        ProofItem(topic: "agreement", text: "Each of the players have a favorite warm-up.", errorIndex: 4, fix: "has", note: "Each is singular, no matter how many players follow it."),
        ProofItem(topic: "agreement", text: "She don't usually plan this far ahead.", errorIndex: 1, fix: "doesn't", note: "She doesn't. Don't belongs to I, you, we, and they."),
        ProofItem(topic: "agreement", text: "There is three reminders set for tonight.", errorIndex: 1, fix: "are", note: "Three reminders are. Is would need just one."),
        ProofItem(topic: "agreement", text: "Neither of the routes are faster at rush hour.", errorIndex: 4, fix: "is", note: "Neither is singular — neither one is faster."),
        ProofItem(topic: "agreement", text: "The team have picked its new captain.", errorIndex: 2, fix: "has", note: "The team acts as one thing here: the team has."),
        // -- doubled words --
        ProofItem(topic: "word-choice", text: "Meet me at at the corner around noon.", errorIndex: 3, fix: "", note: "A doubled little word — the eye skates right over it."),
        ProofItem(topic: "word-choice", text: "I think that that plan needs one more step.", errorIndex: 3, fix: "", note: "One that too many. Reading aloud catches these."),
        ProofItem(topic: "word-choice", text: "She said the the meeting moved to Thursday.", errorIndex: 3, fix: "", note: "Double the — the most-missed typo in proofreading."),
        // -- word choice --
        ProofItem(topic: "word-choice", text: "Can you borrow me a pen for the form?", errorIndex: 2, fix: "lend", note: "You lend out; you borrow in. The pen travels lend-ward."),
        ProofItem(topic: "word-choice", text: "Lay down for twenty minutes before the call.", errorIndex: 0, fix: "Lie", note: "Lie down yourself; lay down an object."),
        ProofItem(topic: "word-choice", text: "The sunset last night was very unique.", errorIndex: 5, fix: "truly", note: "Unique can't be very — it's already one of a kind."),
        ProofItem(topic: "word-choice", text: "Irregardless of the score, we play again Friday.", errorIndex: 0, fix: "Regardless", note: "Regardless already means without regard — the ir- doubles the negative."),
        ProofItem(topic: "word-choice", text: "I could of finished it with ten more minutes.", errorIndex: 2, fix: "have", note: "Could have — could've just sounds like could of."),
        // -- apostrophes --
        ProofItem(topic: "apostrophes", text: "The Smiths dog knows everyone on the street.", errorIndex: 1, fix: "Smiths'", note: "The dog belongs to the Smiths: Smiths' (whole-family possessive)."),
        ProofItem(topic: "apostrophes", text: "Fresh bagel's are half price after four.", errorIndex: 1, fix: "bagels", note: "Plain plural, no apostrophe — the bagels own nothing."),
        ProofItem(topic: "apostrophes", text: "Whos turn is it to water the plants?", errorIndex: 0, fix: "Whose", note: "Whose owns the turn. Who's = who is."),
        ProofItem(topic: "apostrophes", text: "The teams jerseys arrived a size too small.", errorIndex: 1, fix: "team's", note: "The jerseys belong to the team: team's."),
    ]
}
