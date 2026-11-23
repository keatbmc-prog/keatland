# Keatland 3D: the Hub (vertical slice)

A first-person, browser-based Three.js/WebGL slice of Keatland's central hub: a vast, ominous structure
hanging in the dark that is also alive. It breathes, has a heartbeat, a congregation, a giant pencil
that writes in the air, a sword that does not want to come out of its stone, and a mouth that eats you.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (relative base, so it works from any folder or file host)
npm run preview    # serve dist/
```

`dist/` is fully static (no server code). Open it through any static server, for example
`cd dist && python3 -m http.server 4180`. It cannot run from `file://` because textures and the model
manifest are fetched.

## Controls

| Input | Action |
| --- | --- |
| Click | enter (pointer lock, starts the audio) |
| Mouse | look |
| W A S D / arrows | move |
| Shift | run |
| E | pull the sword; enter the photo cube; in the gallery, open the photo you are looking at (also left click) or return through the small cube; get into the stolen car; in the story realm: the valet lectern or the EXIT door (back to the hub), try the FREEDOMLAND door, knock on the Catecholamine Works |
| Esc | release the pointer |
| Touch (basic) | drag on the left half of the screen to move, on the right half to look |

Things to try: walk into the circle while they chant; stand under the pencil; pull the sword
several times; walk down the ribcage bridge into the face's mouth; at the bottom of the stairs,
go through the door; walk into the twisting photo cube to the left of the entrance; and get into the
maroon sedan parked under the KEATLAND MOTORS sign on the north-west rim.

## Architecture

```
src/
  main.js                 bootstrap: renderer, lights, world assembly, simulation loop, triggers, debug hook
  core/
    noise.js              seeded simplex / fbm / ridged noise (JS) and GLSL_NOISE (kl_snoise, kl_fbm)
    quality.js            low / medium / high presets
  render/
    fog.js                replaces three's fog chunks: distance + analytic height fog + drifting banks
    post.js               EffectComposer: render -> NaN scrub -> UnrealBloom -> output -> finish pass
                          (warp, swirl, chromatic split, grade, vignette, film grain, flash, fade)
    effects.js            instanced cilia field shader, spore particles, distant blinking eyes
  materials/
    svgArt.js             SVG artwork generators (honeycomb, iris, sclera, sigils, rune bands, relief panels,
                          pencil livery, serpent silhouettes, checker)
    textures.js           SVG -> canvas -> texture, SVG -> normal map, tileable height/normal maps, text textures
    library.js            organicMaterial (MeshStandardMaterial + onBeforeCompile: breathing, sway,
                          pulsing world-space veins, fresnel rim, colour noise) and the shared material set
  geometry/
    sweep.js              sweep tubes along curves, displaced blobs
    generators.js         recursive tendril trees, vertebrae (+ instanced chains), helical pillars, teeth rings,
                          scattering on surfaces
    surfaces.js           radial platform surfaces, decals that conform to the floor, spherical shell patches
  world/
    layout.js             every important coordinate + analytic floor height functions (used for collision)
    hub.js                platform, ribs, pillars, honeycomb lattice, crown, hanging spines, tendril forests,
                          colonnade relief slabs, bridge, the Dreamer's face/mouth, floor detail, debris
    below.js              gullet tunnel, floating stairs, landing, door
    distant.js            depth layers: far pillars, arches, vertebrae, hanging masses, drifting silhouettes
    sky.js                abyss shader (veils, glow from below, eye halo, stars)
    whispers.js           lines of text written into the world that write themselves in as you approach
    cubeShrine.js         the photo cube's cradle, rune ring, motes and light in the hub
    gallery.js            the gallery chamber inside the cube (frames, per-piece lighting, exit cube)
  entities/
    heart.js              the heart: lub-dub drives U.heartbeat (veins, light, audio)
    pencilTentacle.js     the pencil-tentacle: own state machine (coil / draw / watch / notice), air trails
    creatures.js          the congregation: wander / gather / chant / procession / bow, startle, shyness
    sword.js              sword in stone: proximity tremble, resisting pull, light burst, sparks
    skyEye.js             the eye in the sky: sleep / opening / wander / stare
    photoCube.js          self-twisting 3x3x3 photo cube (layer turns, unwind-to-solved, photo wipes)
  player/                 pointer-lock FPS controller, collision world (ground providers + cylinders)
  audio/audio.js          procedural WebAudio: drone, wind, spatial formant chant, pencil scratch, heartbeat,
                          groans, sword strain/burst, whoosh, gulp. Starts on the first click.
  transitions/            swallow(): mouth -> gullet ride -> spat out above the stairs.
                          fold(): through the door, carried up around the hub, back to the start.
                          storyIn()/storyOut(): the stolen car <-> the empty valet curb (story realm).
  audio/storyAudio.js     story realm sound: desert wind, fluorescent hum, hold music, grinder, crashes,
                          doors, Dale's babble, Yesterkeat's PA
  story/                  the Keatland Reception story realm (see "The story portal" below)
  data/storyLines.js      every word the story realm says (signs, Yesterkeat, Dale): edit freely
  assets/modelRegistry.js GLB/glTF slot registry
tools/
  shoot.mjs               headless verification + screenshots (19 named views) -> screenshots/
  walk.mjs                scripted walkthrough -> screenshots/walkthrough.mp4
  shoot-portal.mjs        portal verification shots (cube, transitions, gallery) -> screenshots/p*.png
  shoot-story.mjs         story portal shots (car, transition, lot, reception, backrooms, Dale) -> screenshots/s*.png
  fetch-instagram.mjs     refresh public/gallery/ from the public Instagram profile (no login)
  still.mjs, smoke.mjs    one-off render / smoke test helpers
```

Everything is procedural: no binary art ships with the slice except the fonts (Apache/OFL licences
in `public/fonts`). Shared uniforms in `library.js` (`U.time`, `U.heartbeat`, `U.ritual`, `U.ritualPos`)
let every material respond to the heart and the ritual.

Performance: repeated parts are `InstancedMesh` (vertebrae, ribs, hex lattice, cilia, teeth, shards,
fungus, debris) or merged into one geometry per material. Animation is in the shaders where possible.

## The Instagram portal (photo cube and gallery)

To the left of the entrance, a 3x3x3 twisty cube floats in a cradle of sinew fingers
(`entities/photoCube.js`, `world/cubeShrine.js`). Its stickers are photos from Instagram
@keaten.blank. When the cube is solved, each face shows one whole photo. Scrambled, the faces become
a mosaic of slices. It twists by itself: calm single turns, frantic bursts, and every so often it
unwinds its own history back to solved, holds, and swaps every face to new photos. Faces also wipe to
the next photo every few seconds. Each turn makes a spatial clack.

Walk into the cube (or press E near it). It swells around you until one photo fills your sight. You
come out of that same photo, hanging on the wall of the gallery (`world/gallery.js`), as the room
grows to full size around you (you shrank). The gallery is a ribbed, breathing chamber. Each photo
hangs in a knotted frame (gilded, bone or chitin) in its own alcove, with its own lamp-pod, light cone
and warm wash. Look at a photo and press E (or click) to open its Instagram post in a new tab. The
pointer is released first. To go back, walk into the small cube on the spine in the centre (or press
E near it). You dive into it and are pushed back out of the big cube in the hub while it shrinks back
to size.

### Swapping photos

The photos are local files in `public/gallery/`, listed in `public/gallery/manifest.json`:

```json
{
  "account": "keaten.blank",
  "profileUrl": "https://www.instagram.com/keaten.blank/",
  "photos": [
    { "file": "ig-01.jpg", "caption": "November 12, 2026", "postUrl": "https://www.instagram.com/keaten.blank/p/Dfp_p9QGgwG/" }
  ]
}
```

Add, remove or reorder entries. Only `file` is required. `postUrl` defaults to the profile, and any
extra fields are ignored. The gallery widens and hangs as many frames as there are photos (12–30
works well), and the cube cycles through all of them. Any size or aspect ratio works: the cube uses a
centre square crop, the frames use the full photo, and large files are downscaled at load time. If a
file is missing, a painted stand-in clearly labelled PLACEHOLDER is shown instead.

`tools/fetch-instagram.mjs` refreshes the folder from the public, logged-out profile page. It opens
the page in headless Chromium with no login or credentials, then visits each post for the full-size
image and carousel slides. Run it with `node tools/fetch-instagram.mjs keaten.blank 30`. Logged out,
Instagram only shows the latest 12 posts, so anything older has to be added by hand.

## The leaf portal and the jungle

On the hub's east rim, at about (21, 0, -10), there's a **ribbed archway of fused vertebrae** with sinew cables and splayed roots. A **living curtain of leaves** hangs from it and glows faintly green from behind. Walk into it, or press **E** within about 5 m:
- The leaves close over the camera as a streaming swarm, until there is nothing but leaves.
- They thin out and you're standing at the south end of the jungle.

At the north end of the jungle's path there's a paler, gold-lit arch. Walk through it, or press E, to come back out of the hub's curtain, facing away from it.

**The jungle** (`src/zones/jungle.js`) is a bounded pocket of about 31 m radius at (-400, -400, 400):
- **Plants:** huge layered leaves in three kinds: broad, monstera with torn fenestrations, and fern frond. The leaf textures are painted on canvas at boot (alpha-cut, chewed edges, emissive vein maps). Some broad leaves carry an eye-spot.
- **Trees and dressing:** buttressed trunks (solid) with bone knuckles, old vertebra ribs arching over a loose path, and hanging and slung vines.
- **Light and air:** a shadow-casting canopy that breaks the light into dapples, light shafts, spores, fireflies and dense green fog.
- **Edges:** the world ends in a wall of growth.
- **Leaves never trap you.** They have no collision; only trunks and rib feet do. The foliage vertex shader (`src/zones/foliage.js`) handles them:
  - it sways them in the wind
  - it pushes them out of the way in a body-height band around you, so they block your view but part as you walk
  - it shakes them wherever something is moving

**The stalker** (`src/entities/stalker.js`) is a tall, thin, hunched thing with three small wet eyes. It runs its own state machine:

| State | Behaviour |
|---|---|
| `stalk` | Moves between leaf-dense cover cells 8–13 m away, preferring behind you. |
| `peek` | Settles at the edge of your view 7–11 m out, tilts its head and lets its eyes catch the light, with clicks. |
| `circle` | A 7.5 m orbit with breathing. |
| `rush` | From behind, to about 2 m, with a thump and a growl. Then it's gone. |
| `retreat` | Look straight at it for about half a second, or get within 3.5 m, and it bolts with a crash of leaves. |

It also shakes decoy bushes where it isn't. Its position drives the leaf-rustle shader and the spatial sound.

**Sound** (`src/audio/jungleAudio.js`) is all procedural WebAudio with HRTF panning:
- **Ambience:** an insect chorus, leaf wind and drips.
- **The stalker:** breathing, rustle, growls, clicks and low thumps, all at its position.
- **Your own rustle** when you push through leaves.

The hub drone is ducked while you're in the jungle.

### The voice

Every 45–120 s in the jungle, and every 150–320 s in the hub, a disembodied voice moans one long, drawn-out word. It comes from somewhere among the trees: a random bearing 9–20 m away, drifting as it speaks, wind-carried (a wandering low-pass, tremolo and a trunk echo).

The lines live in **`src/data/voiceLines.js`**, which you can edit:
- Mostly *"proooojects…"*.
- Rarely *"groooowth…"*.
- Sparingly *"tomorroooow…"*, *"jettisoooon…"* and *"somedaaaay…"*.
- Each line has `weight`, `stretch` (how long the vowel is held) and `zones`.
- `VOICE_SCHEDULE` sets the cadence for each zone.

The voice is synthesised in `src/audio/voice.js` as a formant vocoder: a glottal sawtooth plus a sub-octave, breathy aspiration, three gliding formant bands, and fricative and burst noise. The pitch is a falling moan. An offline render is in `screenshots/voice-sample-projects-growth-someday.wav`.

Only very faint text appears: the word surfaces blurred at about 15% opacity and dissolves (`#voice-text`).

**To use a recorded voice instead:** drop a file in `public/voice/` (e.g. `projects.mp3`) and add `audio: 'voice/projects.mp3'` to the line. The file is played through the same spatial, wind and echo chain. To add a new synthesised word, add a phoneme list to `PHONEMES` (mark the held vowel with `'L'`).

### Quality

Foliage counts, trunks, vines, canopy, litter, fireflies and the transition swarm all scale with `quality.detail` (low 0.55, med 0.8, high 1.0). The spores scale with `quality.particles`. The canopy shadows follow `quality.shadows`.

## The story portal: Keatland Reception (Parts Two and Three)

On the hub's north-west rim a sun-faded maroon sedan sits on a patch of cracked desert asphalt that
should not be there, under a buzzing **KEATLAND MOTORS** pylon ("PRE-OWNED · PRE-JACKED ·
POST-CATALYTIC"). Its catalytic converter has been sawn off (the cut exhaust hangs under the sills) and the
driver's door is open. Walk into the door (or press E): the camera climbs into the driver's seat, the door
shuts, the sign flares warm white, and you come out sitting where the car used to be: the empty valet
curb in front of Keatland Reception, in the desert sun. You stand up facing the lonely lectern.

What is there (all from Part Two "Welcome to Keatland" and Part Three "Backrooms and Sales Rep 101"):

- **The lot**: big sky with drifting clouds, mesas in a ring, a sun-bleached lot of cracked asphalt with faded
  stall lines, valet hatching and VALET PARKING ONLY, oil stains, broken glass where the car was, sand drifts,
  tumbleweeds, scrub, rusted lamp posts, power lines, the pylon with its letter board (KEATLAND OPERATIONS
  DEPT. / WE FUCK THINGS UP.) and a bird's nest. The lectern has a VALET placard, a sticky note ("we ain't got
  one") and an empty key board. Moss stands at the empty curb holding the catalytic converter. To the west a
  line of cottonwoods, where an angle grinder starts up now and then (sparks in the trees) and where the
  voice comes from ("proooojects…", rarely "groooowth…").
- **Reception**: the counter with the WE FUCK THINGS UP stickers, KEATLAND OPERATIONS lanyards, Keaten's
  business card (Head of Managed Risks), the validation tent card, the polished dorodango with its appraisal
  (~~DIRT~~ EVIDENCE, 94%), the converter tagged "…Why is it lighter?", the mini fridge with the Human Pretzel
  magnet, hold music leaking out of the phone. The cardboard-box CEO desk: walk up to it and the plaque
  turns from **CEO** to **HUMANE REALIZATIONS**, the chair comes apart under Keaten (in the mop-head wig), the
  front door is gone behind you (drywall where it was: there are no doors out), and Keaten gets up and leaves
  through the back. Posters: Humane Realizations, Error Correction, The Human Pretzel, Fewer Motivational
  Posters, the facilities map (PLANET BULLSHIT / NEAREST EXIT: TOMORROW), the career ladder, FEELINGS GO HERE,
  COMPLAINTS with a mop, a queue to be humanely realized.
- **The Backrooms** ("Building C", a windowless annex behind Reception): yellowed wallpaper, damp carpet,
  drop ceilings and buzzing fluorescent panels (some flicker, some are dead). The hallway doglegs so no
  daylight follows you. A ceiling tile falls as you pass and shows an office room above, its fluorescent
  tubes standing on end and a desk hanging half over the edge. Branches push through the drywall (WHY ARE
  THE TREES IN HERE NOW?!). Accounting is off to the left. The sales office has the Keatland Motors brochure
  desk (the 2026 brochure, the clipboard prophecy DALE WILL HAVE $11 AT 3:17 A.M., the pen, the chair pulled
  out with HAVE A SEAT, MOSS., Keaten without the wig pulling it out), the FREEDOMLAND poster and diorama,
  BENEFITS INCLUDE, CRTs, filing cabinets, a compass rose. Beyond it a corridor of AUTHORIZED PERSONNEL ONLY
  doors **loops back on itself**: the third door puts you back at the second, twice (watch the wet floor sign),
  and then lets you reach the end: the locked **FREEDOMLAND** door (its doormat: "Everything I do brings me back
  to the same fucking doorstep."), the **EXIT** door marked NEAREST EXIT: TOMORROW (back to the hub), and the
  steel doors of the **Catecholamine Works**, white light bleeding round them (press E to go in: see below).
- **Dale from Building C** roams the back on his own routine (unscrewing the bulb from the brochure-desk lamp,
  staring at the Freedomland door, listening at the Works, pacing Accounting, smoking). When he sees you he
  power-walks after you, never quite running, asking for smokes and "somedat"; his words are hand-lettered in
  the air beside him and spoken by a little formant synthesiser. Catch-up gets you "…is it somedat?" and a
  cooldown. He hears the voice in the trees too ("SEE? THEY HEAR IT TOO.").
- **Yesterkeat** speaks over the ceiling speakers: a chime, crackle, then the line, scrolled on amber LED boards
  under the speakers (ATTENTION KEATLAND EMPLOYEES… FREEDOMLAND!, the eligibility small print at the brochure
  desk, the ethics reminder, and at the FREEDOMLAND door a countdown in real minutes from "Seven minutes
  remaining." that ends in "Linear time is a myth."). The voice is the browser's speech synthesiser (pitched
  down) when it has one, a recorded file if a line has `audio`, otherwise a low synthesised mumble.

Nothing is shown in a UI panel: every word is a sign, sticker, brochure, sticky note, plaque, doormat, LED
board or hand-lettered shout. **All of it is editable in `src/data/storyLines.js`** (Yesterkeat lines and
timing, Dale's lines by mood, and every sign). The voice in the trees uses `src/data/voiceLines.js` (zone
`story`, schedule `story`/`storyFirst`).

Leaving: E at the valet lectern (before Reception seals) or at the EXIT door. The sun flares white and you
climb out of the car in the hub.

**Characters are stand-ins.** They are simple procedural figures (lathe and capsule parts with jointed
limbs, a few poses) registered as GLB slots, so real models can replace them (see below):
`character:moss`, `character:keatenHR`, `character:keatenBackrooms`, `character:dale`, plus `story:car`.
Assumption from the art references, not confirmed: the lanky curly-haired man with mechanical arms is
**Moss** and the bald bearded man is **Keaten**; the HR person in the mop-head wig and pink cardigan is Keaten
wearing a mop as a wig. Swap or re-dress them by editing `src/story/figures.js` or by dropping in GLBs.

Code: `src/story/` (`layout.js` coordinates, `exterior.js`, `reception.js`, `backrooms.js`, `rooms.js` (a
1 m cell planner that builds walls, floors, ceilings and collision from room rectangles), `dale.js`,
`yesterkeat.js`, `speech.js` (world-space words), `figures.js`, `paint.js` (canvas textures: asphalt,
stucco, wallpaper, carpet, signs), `sky.js` (daylight sky dome, environment, mesas), `kit.js`,
`hubEntrance.js` (the car and pylon), `story.js` (assembles it: zones, sun/fluorescent lighting, light pool,
interactions)), `src/audio/storyAudio.js` (wind, hum, hold music, grinder, crashes, doors, Dale's babble,
the PA), `storyIn`/`storyOut` in `src/transitions/transitions.js`. The realm lives far from the hub in the
same scene (offset `S` in `layout.js`) and main.js switches it as realm `'story'` (its own sky dome,
daylight environment map, exposure, bloom, warm fog, the hub's moon light reused as the sun).

Shots: `node tools/shoot-story.mjs [filter]` → `screenshots/s01…s19`.

## The Catecholamine Works (Parts Four to Six)

At the end of the Backrooms loop, the steel double doors marked **CATECHOLAMINE WORKS** now open. Press E
at them: the leaves swing in, the light whites out, and you are standing on a landing high up in the
north wall of a huge brick-and-steel hall at 3:16 AM. Keaten (cane, later the tiny top hat) and Dale go
down the spiral stair ahead of you, the cane going *tch* on every step, and you arrive on the factory
floor. The scene then plays itself as world events, sound and voice; you are free to walk between the
beats, and at a few moments (the knock-down, the drain pull, the look into the hold) the camera is taken
for a short ride.

What is there:

- **The hall**: 64 × 88 m, 28 m to the roof trusses. Rows of tall windows with mullions and light shafts,
  skylights, a ring catwalk and a cross gantry (grating), a spiral stair, 28 hanging lamps with light
  cones, dust in the air, warm fog. Six riveted vats with domes, ladders, sight glasses and labels
  (TYROSINE, L-DOPA, DOPAMINE, NOREPINEPHRINE, EPINEPHRINE, DOPAMINE β-HYDROXYLASE), eight lit glass
  columns, colour-coded pipe runs (instanced), the bottling line (FILLER 1, CAPPER 2, a moving belt of
  bottles) under the three stage boards: DOPAMINE "Want." / NOREPINEPHRINE "PAY ATTENTION TO THAT FUCKING
  THING." / EPINEPHRINE "THE FUCKING THING IS NOW CHASING YOU.", the red **NOREPINEPHRINE: EMERGENCY
  DISTRIBUTION ONLY** pipe with its valve wheel and the NORMAL / ALERT / FUCK gauge, the big intake doors in
  the west wall, the FREEDOMLAND door in the east wall, a ring of floor plates round the drain (KEEP CLEAR
  OF DRAIN), the CJP pier and three CRT monitors with the clock (3:16 AM).
- **The flood** (Part Four and Five): Dale opens the valve, the gauge swings into FUCK, sirens and red
  beacons, the intake doors burst and a tide front runs the length of the hall (a displaced, foaming liquid
  surface carrying sand, lumber, PVC, buckets, glass, scrap and boxes, with named pieces from the story:
  the greenhouse hoop and clothesline, the half-painted tin, the whiteboard, the HUMAN RESOURCES desk that
  Dale rides, the guitar, the "but what if" that circles). The level rises, Keaten swims (and does the
  ballet), Moss is swept to the dopamine pipe, everyone climbs out onto the bolted-down vat.
- **The drain** (Part Five): the chain, three heaves on the stopper (press E at each "pull", or it passes
  on its own after 40 s), the whoosh, the vortex funnel and the flood draining out of the hall in about
  16 s, the debris settling on the floor, the complaint filed on the monitors.
- **The Cathartic Jettison Protocol** (Part Six): the panel with its three valves, key slot and red button
  under the brass plaque (CATHARTIC JETTISON PROTOCOL / … / WARNING: RELEASE IS IRREVERSIBLE) and the
  Sharpie note; Yesterkeat on the PA; the floor plates draw back and the **Jettison Hold** opens: a deep
  shaft with ledges of stored cargo (boxes, doors with no building, chairs, stacked headquarters with lit
  windows, filing cabinets, a hospital bed with a chair) and unfinished sentences floating in it, down to a
  floor stamped JETTISON HOLD. Then the executive chair and desk come through the ceiling with Keaten in
  it, the drawer (the carton, the keys, the cash, the stickers, the pink slip), the cookie, the dollar,
  the onboarding screen (APPLICANT: DALE / STATUS: HIRED / PREREQUISITE: MUST FIRST BE FIRED), and the
  clock turning to 3:17 and PROCEDURAL ERROR.

Every line from Parts Four to Six is in **`src/data/worksScript.js`** in order, unchanged from the story
text, with the staging steps between them (`{do}`, `{wait}`, `{gate}`, `{label}`). Moss's lines appear
hand-lettered just in front of you; Keaten's, Dale's and the worker's appear beside their heads with a
babble voice; Yesterkeat and the PA come out of the nearest ceiling horns (speech synthesiser when the
browser has one). Nothing is in a UI panel.

Audio (positional WebAudio, `src/audio/worksAudio.js`): a hum per vat, the conveyor clink, the siren and
beacons, the flood roar that follows the front, churn, the drain gurgle, and the one-shots (valve squeak,
krang of the doors, chain clank, plates, ceiling crash, drawer, lighter, cookie, the guitar).

Leaving: walk back to the foot of the spiral stair and press E. You climb out and come back through the
steel doors into the Backrooms corridor.

Code: `src/zones/works/` (`layout.js` coordinates, `factory.js` the hall and all machinery, `paint.js` canvas
textures, `shaders.js` the flood surface, glass columns and light shafts, `flood.js` the liquid and its
debris, `hold.js` the Jettison Hold, `cast.js` the people and props, `director.js` runs the script,
`works.js` assembles it: lighting, environment, collision cages, camera rides), `src/data/worksScript.js`,
`src/audio/worksAudio.js`, `worksIn` / `worksOut` / `ride` in `src/transitions/transitions.js`. It is realm
`'works'` in main.js, placed far from the others in the same scene (offset `WORKS`).

GLB slots: `character:keatenWorks`, `character:daleWorks`, `character:worker`, `prop:drainStopper`,
`prop:execChair` (the chair and desk), `prop:cjpPanel`.

Shots: `node tools/shoot-works.mjs [filter]` → `screenshots/f01…f25`. Debug: `__keatland.worksIn()`,
`worksOut()`, `worksGo(x, z, yaw, pitch, label)` (stand at works-local x, z and jump the scene to a script
label: arrive, valve, alarm, flood, hoop, raft, swim, ballet, future, chain, drain, drained, complaint, cjp,
button, konk, plates, hold, chair, cookie, onboarding, end), `works.director`.

Not built: the quarry and the rest of Part Six after the Works.

## Story realm art direction (stylized pass)

The story realm (the lot, Keatland Motors, Reception, the Backrooms and the Catecholamine Works) has a
stylized, saturated, "alive" look; the hub, gallery and jungle are unchanged.

- `src/story/style/toon.js`: the shading kit. `toonify(material, opts)` patches a MeshStandardMaterial
  (maps, shadows, fog and instancing keep working, and any existing shader patch is chained): soft toon
  light bands, shadows tinted violet / teal instead of grey, extra saturation, a coloured fresnel rim, and
  an optional goopy vertex wobble + breathing (`wobble`, `wobbleF`, `breathe`). `TOON.time` drives it;
  `PA.talk` tells the speaker critters Yesterkeat is talking.
- `src/story/style/goop.js`: organic pieces: `blobGeo`, `alienPlant`, `Eyeball` (blinks, follows you),
  `SpeakerCritter` (Yesterkeat's presence: a bulbous horn with an eye and a mouth that flaps on the PA).
- `src/story/style/restyle.js`: runs once after the realm is built. It sweeps every material under the
  story and Works roots into the kit with per-zone rim and shadow colours (materials shared with the hub
  are cloned first), and dresses the zones: alien plants and goop boulders round the lot, eyes on the
  pylon and over the Reception door, eyes and glowing growths in the Backrooms walls, eyes on the Works
  vats, speaker critters in the Backrooms and the Works.
- The sky (`src/story/sky.js`): a teal-to-magenta-to-orange gradient, toon clouds, a ringed planet and a
  small moon; candy-striped mesas. Zone lighting, fog and bloom colours were retuned in `story.js` and
  `works.js`; the flood is a glossy teal / acid / magenta goo (`src/zones/works/shaders.js`).
- Characters (`src/story/figures.js`): big heads (`headScale`), cartoon eyes that blink and follow you,
  a mouth that flaps while they talk (the speech layer calls `figure.talk()` for every line), eyebrows
  that pop on shouted lines, squash-and-stretch breathing and steps, rounder hands, a saturated palette.
  The GLB slots are unchanged.

Before/after shots: `screenshots/r01…r15-*-compare.jpg` (with `-before.png` / `-after.png`).

## Adding GLB / glTF models

Hero objects are registered as slots: `sword`, `creature:Gloria`, `creature:Mortimer`, `creature:Dot`,
`creature:Big Rhonda`, `creature:Wendell`, `heart`.

1. Put the file in `public/models/`, for example `public/models/sword.glb`.
2. Add an entry to `public/models/manifest.json`:

```json
{
  "sword": { "url": "models/sword.glb", "scale": 1, "position": [0, 0, 0], "rotation": [0, 0, 0], "hideProcedural": true }
}
```

The model is put into the slot's group, so the same behaviour code keeps moving it (the sword
still trembles and the creatures still walk). Set `hideProcedural: false` to keep the procedural mesh too.
To make a new object swappable, call `registerSlot('my-id', group)` after you build its group.
For one-off props, use `loadModel(url)` from `src/assets/modelRegistry.js`.

## Adding procedural structures

1. Pick a place in `world/layout.js` (`L`). If people can walk on it, add a floor function and register it
   with `collision.addGround(fn)` (`fn(x, z)` returns a height, or `null` where there is no floor). Add solid
   columns with `collision.addObstacle({ x, z, r })`.
2. Build geometry with the generators, then merge or instance it:

```js
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge, tendrilTree, vertebraGeometry, vertebraeAlong } from '../geometry/generators.js';

// a spine arching over the path, made of instanced vertebrae
const curve = new THREE.CatmullRomCurve3([V(-10, 0, 0), V(0, 14, 0), V(10, 0, 0)]);
const mats4 = vertebraeAlong(curve, 0.9, (t) => 0.6 + 0.3 * Math.sin(t * Math.PI));
const spine = new THREE.InstancedMesh(vertebraGeometry(3, quality.detail), mats.bone, mats4.length);
mats4.forEach((m, i) => spine.setMatrixAt(i, m));

// branching growth (recursion depth follows the quality preset)
const growth = tendrilTree({ start: V(0, 20, 0), dir: V(0, -1, 0), length: 16, radius: 0.4,
                             depth: quality.tendrilDepth, gravity: 0.7, curl: 0.4, podChance: 0.5,
                             seed: 7, detail: quality.detail });
scene.add(new THREE.Mesh(growth.body, mats.sinew));          // branches
if (growth.pods) scene.add(new THREE.Mesh(growth.pods, podMaterial)); // glowing seed pods
```

3. Use `organicMaterial({...})` (or a material from `makeMaterials()`) so the structure breathes, carries
   pulsing veins and receives the height fog. Geometry attributes `aSway` and `aPhase` (see `ensureAttrs`)
   make hanging parts sway.
4. If it moves, push an `(dt, t) => {}` function into the module's `updaters` list.
5. Scale counts by `quality.detail` so the low preset stays fast.

## Quality settings

Pick a preset with `?q=low`, `?q=medium` or `?q=high` (for example `dist/index.html?q=medium`). Desktop
defaults to high. Touch devices and small screens default to low.

| | low | medium | high |
| --- | --- | --- | --- |
| pixel ratio | 0.75 | 1.0 | 1.5 |
| shadows | off | 1024 | 2048 |
| bloom resolution | 0.35 | 0.5 | 0.5 |
| geometry detail | 0.55 | 0.8 | 1.0 |
| particles | 600 | 1600 | 3200 |
| tendril recursion | 2 | 3 | 3 |
| distant structures | 6 | 12 | 18 |

Presets live in `src/core/quality.js`.

## Debug / automation

`window.__keatland` offers `teleport(x,y,z,yaw,pitch)`, `look`, `advance(seconds)` (deterministic
fast-forward), `pause`, `renderOnce`, `setPhase('gather'|'chant'|'procession'|'bow'|'wander')`,
`pencilState`, `swordPull`, `swallow`, `fold`, `eyeWake`, `portal()`, `portalBack()`, `realm`, `photoCube`,
`gallery`, `aimed()`, `freeCam`, `state`, `fps`, `info()`.

To take verification screenshots, run a static server on `dist/` (port 4180), then
`node tools/shoot.mjs [filter] [--w=1280 --h=720 --q=high]`. This uses headless Chromium with SwiftShader
and writes `screenshots/*.png` and `screenshots/_verify.json` (console errors, load time, FPS).

Story: `K.storyIn()`, `K.storyOut()`, `K.storyGo(x, z, yaw, pitch)` (story-local coordinates, see `src/story/layout.js`), `K.story` (`exterior`, `reception`, `back`, `dale`, `yk`), `K.entrance`.
Works: `K.worksIn()`, `K.worksOut()`, `K.worksGo(x, z, yaw, pitch, label)` (works-local coordinates, see `src/zones/works/layout.js`; `label` jumps the script there), `K.works` (`factory`, `flood`, `hold`, `cast`, `director`, `wAudio`).

Jungle: `K.jungleIn()`, `K.jungleOut()`, `K.jungle`, `K.stalker`, `K.stalkerState('peek'|'circle'|'rush'|'stalk'|'retreat'|'hidden', seconds)`, `K.voiceSay('projects')` (audio must be started by clicking in). Shots: `node tools/shoot-jungle.mjs [filter]` → `screenshots/j01…j12`.

## Notes

- The text lines in `world/whispers.js` are SAMPLE copy that riffs on the 2D prototype. Replace them with
  your own words.
- Gallery photos are Keaten's own Instagram posts (@keaten.blank). They were downloaded from the
  public profile so they can be served locally, because Instagram blocks hotlinking.
- Fonts: Permanent Marker, Special Elite (Apache 2.0), Rubik Wet Paint, Rye, Oswald, VT323, Caveat (OFL). See
  `public/fonts/FONTS-LICENSE.txt`. The four story fonts ship as Latin-subset .ttf.
