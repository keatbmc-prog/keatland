// Everything the story realm SAYS lives here, so it can be edited without touching the builders.
// The words come straight from the Keatland story, Part Two ("Welcome to Keatland") and Part
// Three ("Backrooms and Sales Rep 101"). Nothing is shown in a UI panel: these strings are painted
// onto signs, brochures, sticky notes and plaques, scrolled on the announcement boards under
// Yesterkeat's ceiling speakers, or shouted by Dale (hand-lettered in the air beside him).
//
// Optional `audio` on a Yesterkeat line: a recorded file in public/voice/ (e.g. 'voice/yk-attention.mp3').
// When present it plays through the ceiling-speaker (PA) chain instead of the browser's speech
// synthesiser. Leave it undefined to use speech synthesis (when the browser has a voice).

/** Yesterkeat over the ceiling speakers. `id` is used by triggers in the backrooms/reception. */
export const YESTERKEAT = [
  { id: 'attention', text: 'ATTENTION KEATLAND EMPLOYEES. Any employee who successfully makes a sale this week will be entered for a chance to win an ALL-EXPENSES-PAID, LUXURIOUS vacation to… FREEDOMLAND!' },
  { id: 'eligibility', text: 'Eligibility restrictions apply.' },
  { id: 'employed', text: 'Employees must remain employed through date of travel.' },
  { id: 'ethics', text: 'Keatland reminds employees that ethical sales practices are strongly suggested wherever economically feasible.' },
  { id: 'remaining', text: '{n} minutes remaining.' }, // n starts at Seven and counts down in real minutes
  { id: 'remaining1', text: 'One minute remaining.' },
  { id: 'myth', text: 'Linear time is a myth.' },
];
/** Spoken numbers for the countdown. */
export const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
/** Seconds between unprompted announcements in the backrooms (min, max). */
export const YESTERKEAT_SCHEDULE = [55, 110];

/** Dale from Building C. `mood` picks when he says it. */
export const DALE = {
  notice: ['HEYHEYHEYHEYHEY. YOU. YOU YOU. YOU GOT ANY SMOKES?', 'Hey man, you got like… a cigarette? Or five dollars? Or a cordless drill you ain’t using?'],
  chase: ['HEY, CAN I BORROW SOMEDAT?', 'WAIT WAIT WAIT! I JUST NEEDA BORROW IT!', 'SOMEDAT!', 'YOU KNOW. SOME. DAT.', 'Or five dollars?', 'YOU GOT ANY SMOKES?'],
  caught: ['…is it somedat?', 'I GOT TWELVE DOLLARS.', 'Are y’all on drugs too?'],
  badge: ['Found it.', 'Yeah.'],
  hearsVoice: ['SEE? THEY HEAR IT TOO.', 'I NEVER NOT HEAR IT. Prolly the drugs.'],
  idle: ['…he makin somedat.', 'I GOT TWELVE DOLLARS AND THIS!'],
  giveUp: ['…you got one?', 'Then why the fuck would I buy it?'],
};

/** Signs and printed matter. Arrays are lines. */
export const SIGNS = {
  // exterior
  motorsPylon: ['KEATLAND', 'MOTORS'],
  motorsLetterBoard: ['KEATLAND OPERATIONS DEPT.', 'WE FUCK THINGS UP.'],
  reception: 'KEATLAND RECEPTION',
  facadeServices: ['SALES', 'SERVICE', 'PARTS', 'WHATEVER'],
  valetPlacard: 'VALET',
  valetSticky: ['we ain’t got one'],
  curbPaint: 'VALET PARKING ONLY',
  lotSign: ['VISITOR PARKING', 'KEATLAND OPERATIONS', 'WE FUCK THINGS UP'],
  riskSign: ['VEHICLES LEFT WITH THE VALET', 'ARE THE RESPONSIBILITY OF THE', 'HEAD OF MANAGED RISKS'],
  // reception
  banner: ['KEATLAND OPERATIONS DEPARTMENT', 'WE FUCK THINGS UP.'],
  stickers: 'WE FUCK THINGS UP',
  lanyard: 'KEATLAND OPERATIONS',
  pretzel: 'HUMAN PRETZEL',
  businessCard: ['KEATEN', 'HEAD OF MANAGED RISKS', 'Keatland Operations Department'],
  validate: ['Do y’all validate parking?', '— If you gave your keys to the valet attendant… you won’t need to be validated… because… we ain’t got one… and your whip’s been jacked.'],
  converterTag: ['…Why is it lighter?'],
  dorodango: ['ASSET DESCRIPTION: ~~DIRT~~ EVIDENCE', 'APPRAISED VALUE: DIRT', 'EMOTIONAL VALUE: PRICELESS', 'LIKELIHOOD KEATEN STEALS IT BACK', 'BECAUSE HE THOUGHT OF A PROJECT: 94%'],
  plaqueFront: 'CEO',
  plaqueBack: 'HUMANE REALIZATIONS',
  hrBox: ['HR', 'Humane Realizations', '(We’re People Too)'],
  feelings: ['FEELINGS', 'GO', 'HERE'],
  complaints: 'COMPLAINTS',
  careerLadder: ['ENTRY LEVEL', 'SUFFERING', 'CHARACTER', 'DEVELOPMENT', 'ADDITIONAL', 'RESPONSIBILITIES', 'SAME PAY', 'SUFFERING'],
  hrPoster: ['HUMANE REALIZATIONS', 'Where employees are sent to experience', 'a manageable amount of', 'character development.'],
  pretzelPoster: ['THE HUMAN PRETZEL', 'Flexibility has a pathological extreme', 'just like rigidity does.', '“…chomp my own buns in the tizzy of it.”'],
  errorPoster: ['ERROR CORRECTION', 'A good system doesn’t require every', 'individual decision to be right.', 'It needs to notice when predictions fail', '…and then actually update.'],
  specsPoster: ['FEWER MOTIVATIONAL POSTERS.', 'MORE LOAD-BEARING SPECIFICATIONS.'],
  metaphor: ['This entire corporation is', 'one metaphor wearing a necktie.'],
  map: ['KEATLAND FACILITIES', 'YOU ARE HERE:', 'PLANET BULLSHIT', 'THIS SUCKS DONKEY DICK GALAXY', 'NEAREST EXIT:', 'TOMORROW', '*Linear time is a myth.'],
  holdMusic: 'We fuck things up…',
  // backrooms
  graffitiMiddle: ['THEN WHERE ARE THE', 'MIDDLE ROOMS?!'],
  graffitiRelative: ['BACK IS A RELATIONAL POSITION.', 'RELATIVE TO WHAT?!'],
  graffitiStart: ['DON’T YOU', 'FUCKING START.'],
  treesGraffiti: ['WHY ARE THE TREES', 'IN HERE NOW?!'],
  doormat: ['Everything I do brings me back', 'to the same fucking doorstep.'],
  locked: 'Locked.',
  wetFloor: ['CAUTION', 'WET FLOOR'],
  feverDream: ['Not a Backrooms fever dream.', 'Fever-dream-themed actual Backrooms.'],
  accounting: 'ACCOUNTING',
  authorized: ['AUTHORIZED', 'PERSONNEL ONLY'],
  brochureFront: ['2026', 'KEATLAND MOTORS', 'PRE-OWNED · PRE-JACKED · POST-CATALYTIC'],
  brochureBack: ['You’re going to make me', 'sell my own stolen car.'],
  clipboard: ['DALE WILL HAVE $11', 'AT 3:17 A.M.'],
  penTag: ['Moss v3.5', 'RIP, good bot.', 'heart of a dying star', 'TSA cannot detect it'],
  haveASeat: ['Have a seat, Moss.'],
  salesPoster: ['SALES REP 101', 'You’re selling features, dumbass.', 'Now you’re selling BENEFITS.'],
  freedomland: 'FREEDOMLAND',
  freedomTag: ['LET GO.', 'MOVE FORWARD.', 'BE FREE.'],
  benefits: ['BENEFITS INCLUDE:', '• INCREASED CLARITY', '• REDUCED MENTAL LOAD', '• EMOTIONAL LIGHTNESS', '• IMPROVED PRODUCTIVITY', '• A BRIGHTER TOMORROW'],
  everything: ['Everything I do brings me back', 'to the same fucking doorstep.'],
  exitTomorrow: ['EXIT'],
  exitSub: ['NEAREST EXIT: TOMORROW'],
  works: ['CATECHOLAMINE WORKS'],
  worksSub: ['DO NOT LICK THE EQUIPMENT'],
  buildingC: ['BUILDING C →'],
};
