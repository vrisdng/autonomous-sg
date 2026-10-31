# A night out

How someone moves through Bojio. Open `docs/fe-map.excalidraw` in [Excalidraw](https://excalidraw.com). Regenerate with `node scripts/fe-map/generate.mjs`.

Green is anyone in the party. Orange is the host only. The drawing reads left to right. Smaller boxes are side trips under the step that opens them. A second frame, Under the hood, sits far below and is one small box per screen.

13 screens. 12 arrows.

| Step | Who | What you see and can do |
| --- | --- | --- |
| Open the app | Everyone | A line for tonight, and the time; Your supper plan, if you have one; Shortcuts to meet, the bill, a ride, last call; Tap Bao to ask something |
| Create or join | Everyone | Start a party with your name; Or paste a code and tap your name; Copy the link for the group chat; Continue once you are in |
| Party home | Everyone | See who is coming; Add your name and home; Train, shared ride, or either; Set when you meet and when you leave |
| Pick a place | Everyone | Swipe left to pass; Swipe right if you want it; Flick up for Anything lah; Live top 3 sits on the deck; Host shares the list first |
| Last call | Everyone | When you should leave; The next bus or train; The route home; Share the journey with the group |
| Share a ride | Everyone | Who is going your way; Find ride partners; Type the fare and see each share; Open the trip in Maps |
| Split the bill | Everyone | The dishes and what you pay; Tap your name on what you ate; Tap I’ve paid when you have; Shares wait until the total is confirmed |

| Side trip | Opens from | Tap | Who | What you see and can do |
| --- | --- | --- | --- | --- |
| Party sheet | Open the app | tap Party · Invite | Everyone | Parties on this phone; Create, join, or continue; Copy the invite; Change the name remembered here |
| Where you are | Party home | tap Home address | Everyone | Search an address; Tap a result to set home; Or pick the area for food |
| Top 3 | Pick a place | tap Top 3 | Everyone | The group’s top three; Change a swipe; Hearts, passes, still waiting |
| Confirm the meetup | Pick a place | tap Confirm meetup | Host | Host locks the place; Everyone sees the tick; Then last call, a ride, or the bill |
| Scan the receipt | Split the bill | tap Scan receipt | Everyone | Snap the receipt; Check each dish and discount; Add them to the bill |
| Confirm the total | Split the bill | tap Confirm total | Host | The amount on the card; Fix a gap with rounding; Confirm before claims open |

| From | Arrow | To |
| --- | --- | --- |
| Open the app | tap Create or join | Create or join |
| Create or join | tap Continue | Party home |
| Party home | tap Start swiping | Pick a place |
| Pick a place | tap Check Last Call | Last call |
| Last call | tap Share a ride | Share a ride |
| Share a ride | tap Split the bill | Split the bill |
| Open the app | tap Party · Invite | Party sheet |
| Party home | tap Home address | Where you are |
| Pick a place | tap Top 3 | Top 3 |
| Pick a place | tap Confirm meetup | Confirm the meetup |
| Split the bill | tap Scan receipt | Scan the receipt |
| Split the bill | tap Confirm total | Confirm the total |
