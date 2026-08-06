import Foundation

// Transcribed from src/lib/games.ts (ORDER_BANK).
// Keep in sync with the web bank when sequences change.
struct OrderItem: Equatable {
    let topic: String
    let title: String
    let steps: [String]
}

enum OrderBank {
    static let sequences: [OrderItem] = [
        // -- kitchen --
        OrderItem(topic: "kitchen", title: "A cup of tea", steps: ["Fill the kettle", "Boil the water", "Pour over the tea bag", "Let it steep", "Add a splash of milk"]),
        OrderItem(topic: "kitchen", title: "Morning toast", steps: ["Slice the bread", "Drop it in the toaster", "Wait for the pop", "Spread the butter"]),
        OrderItem(topic: "kitchen", title: "A pot of pasta", steps: ["Boil salted water", "Add the pasta", "Stir now and then", "Drain it", "Toss with sauce"]),
        OrderItem(topic: "kitchen", title: "Pancakes", steps: ["Mix the batter", "Heat the pan", "Pour a circle", "Flip at the bubbles", "Stack and serve"]),
        OrderItem(topic: "kitchen", title: "Fried egg", steps: ["Heat a little oil", "Crack the egg in", "Wait for the edges to set", "Slide onto the plate"]),
        OrderItem(topic: "kitchen", title: "French press coffee", steps: ["Grind the beans", "Add grounds to the press", "Pour in hot water", "Wait four minutes", "Press and pour"]),
        OrderItem(topic: "kitchen", title: "Grilled cheese", steps: ["Butter the bread", "Add the cheese between slices", "Grill until golden", "Flip once", "Cut diagonally"]),
        OrderItem(topic: "kitchen", title: "A smoothie", steps: ["Add fruit to the blender", "Pour in the liquid", "Blend until smooth", "Taste and adjust", "Pour into a glass"]),
        // -- morning --
        OrderItem(topic: "morning", title: "Out the door", steps: ["Wake up", "Get dressed", "Grab keys and phone", "Lock the door behind you"]),
        OrderItem(topic: "morning", title: "Brushing teeth", steps: ["Wet the brush", "Add the toothpaste", "Brush for two minutes", "Rinse and done"]),
        OrderItem(topic: "morning", title: "A proper shower", steps: ["Run the water warm", "Step in", "Shampoo and rinse", "Towel off", "Hang the towel up"]),
        OrderItem(topic: "morning", title: "Making the bed", steps: ["Pull off the pillows", "Straighten the sheet", "Smooth the duvet", "Pillows back on top"]),
        OrderItem(topic: "morning", title: "Packing a lunch", steps: ["Pick the container", "Make the sandwich", "Add a snack", "Zip the bag", "Into the fridge till you leave"]),
        // -- laundry --
        OrderItem(topic: "laundry", title: "A load of laundry", steps: ["Sort the colors", "Load the machine", "Add the detergent", "Start the cycle", "Move it to the dryer"]),
        OrderItem(topic: "laundry", title: "Ironing a shirt", steps: ["Heat the iron", "Lay the shirt flat", "Press collar and cuffs", "Hang it up warm"]),
        OrderItem(topic: "laundry", title: "Folding a fitted sheet", steps: ["Find the corners", "Tuck corner into corner", "Fold into a rectangle", "Stack it in the closet"]),
        OrderItem(topic: "laundry", title: "A stain rescue", steps: ["Blot, don't rub", "Rinse from the back", "Dab on stain remover", "Wash as usual", "Check before drying"]),
        // -- tech --
        OrderItem(topic: "tech", title: "A software update", steps: ["Back up first", "Download the update", "Install it", "Restart the machine"]),
        OrderItem(topic: "tech", title: "A video call", steps: ["Check camera and mic", "Join the meeting", "Unmute to talk", "Wave goodbye", "Leave the call"]),
        OrderItem(topic: "tech", title: "New phone setup", steps: ["Insert the SIM", "Power it on", "Sign in to your account", "Restore the backup", "Set the wallpaper"]),
        OrderItem(topic: "tech", title: "Posting a photo", steps: ["Take a few shots", "Pick the best one", "Crop and brighten", "Write a caption", "Hit share"]),
        // -- errands --
        OrderItem(topic: "errands", title: "Grocery run", steps: ["Write the list", "Grab the bags", "Shop the aisles", "Pay at the till", "Unpack at home"]),
        OrderItem(topic: "errands", title: "Mailing a package", steps: ["Box it up", "Tape it shut", "Address the label", "Pay the postage", "Hand it over"]),
        OrderItem(topic: "errands", title: "Filling the tank", steps: ["Pull up to the pump", "Pop the fuel door", "Pump the gas", "Hang up the nozzle", "Twist the cap back on"]),
        OrderItem(topic: "errands", title: "Library visit", steps: ["Return the old books", "Browse the shelves", "Pick your stack", "Check them out"]),
        OrderItem(topic: "errands", title: "A haircut", steps: ["Book the slot", "Arrive and check in", "Sit for the cut", "Approve the mirror check", "Tip on the way out"]),
        // -- home --
        OrderItem(topic: "home", title: "Watering the plants", steps: ["Fill the can", "Check the soil first", "Water the dry ones", "Empty the saucers"]),
        OrderItem(topic: "home", title: "Changing a bulb", steps: ["Switch the light off", "Let it cool", "Twist the old one out", "Twist the new one in", "Flip the switch to test"]),
        OrderItem(topic: "home", title: "Hanging a picture", steps: ["Mark the spot", "Drive the nail", "Hang the frame", "Nudge it level"]),
        OrderItem(topic: "home", title: "Taking out the trash", steps: ["Tie the bag", "Lift it out", "Drop in a fresh liner", "Bin it outside"]),
        OrderItem(topic: "home", title: "Washing dishes", steps: ["Scrape the plates", "Fill the sink with suds", "Wash glasses first", "Rinse everything", "Rack it to dry"]),
        OrderItem(topic: "home", title: "Sweeping the floor", steps: ["Clear the chairs", "Sweep into a pile", "Pan the pile up", "Chairs back in place"]),
        // -- out and about --
        OrderItem(topic: "out", title: "Catching a flight", steps: ["Check in online", "Drop the bag", "Clear security", "Find the gate", "Board when called"]),
        OrderItem(topic: "out", title: "A picnic", steps: ["Pack the basket", "Pick a shady spot", "Spread the blanket", "Eat the good stuff", "Pack out the trash"]),
        OrderItem(topic: "out", title: "Renting a bike", steps: ["Find a docking station", "Unlock with the app", "Adjust the seat", "Ride your loop", "Dock it back"]),
        OrderItem(topic: "out", title: "A trip to the pool", steps: ["Pack towel and suit", "Change at the lockers", "Shower before the water", "Swim your laps", "Dry off and head home"]),
        OrderItem(topic: "out", title: "Movie night out", steps: ["Pick the film", "Buy the tickets", "Claim your seats", "Silence the phone", "Watch the show"]),
        // -- winding down --
        OrderItem(topic: "evening", title: "Winding down", steps: ["Dim the lights", "Screens away", "Read a few pages", "Lights out"]),
        OrderItem(topic: "evening", title: "Tomorrow's launchpad", steps: ["Check tomorrow's plan", "Lay out clothes", "Pack the bag", "Keys by the door"]),
        OrderItem(topic: "evening", title: "A bath", steps: ["Start the water", "Add the bubbles", "Soak a while", "Drain the tub", "Wrap up warm"]),
    ]
}
