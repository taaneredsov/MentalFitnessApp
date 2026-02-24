01-30 demo fitness-app
Datum & Tijd: 2026-01-30 15:56:42

Locatie: [Invoegen Locatie]

Aanwezigen: [Invoegen Namen] [Speaker 1], [Speaker 2], [Speaker 3], [Speaker 4], [Speaker 5], [Speaker 6]

1. App Ontwikkeling en Functionaliteit
De app-ontwikkeling vordert, waarbij de technische basis als robuust en flexibel wordt beschouwd. De app is ontwikkeld als een progressive web app (PWA) met een Airtable backend, die gebruikers de mogelijkheid biedt in te loggen via een wachtwoord of een Magic Link. Eenmaal ingelogd, kunnen gebruikers via een wizard een persoonlijk, AI-gestuurd programma samenstellen op basis van doelstellingen, duur en trainingsdagen. Dit programma kan later door de gebruiker worden aangepast, waarna de AI het schema herberekent met behoud van voltooide sessies. De AI-logica, inclusief prompts en regels, is volledig beheerbaar vanuit Airtable. De huidige focus ligt op het afronden van de app voor een eerste release, wat ongeveer een dag debuggen vergt.

1.1 Gebruikersregistratie, Login en Sessiebeheer - Rapporteur: [Speaker 1]
Voortgang: Gebruikers worden aangemaakt via hun e-mailadres en kunnen aan een bedrijf worden gekoppeld. De PWA is installeerbaar op het homescreen van een telefoon. Er zijn twee login-opties: wachtwoord of Magic Link. De sessieduur kan worden verlengd (bv. naar twee weken) zodat gebruikers ingelogd blijven.

Problemen:

De wachtwoord-inlogflow werkt niet correct, waardoor gebruikers een onhandige e-maillink moeten gebruiken.

Na installatie van de PWA op het homescreen moet de gebruiker opnieuw inloggen.

Een nadeel van de PWA-structuur is dat een directe link vanuit een mail naar de app niet mogelijk is; de code moet handmatig worden gekopieerd.

Plan:

De bugs met betrekking tot de wachtwoordfunctie oplossen. -- [Speaker 1]

De installatieflow en gebruikerservaring (bv. opnieuw inloggen) verbeteren. -- [Speaker 1]

1.2 Programma Creatie en Beheer - Rapporteur: [Speaker 1]
Voortgang: Een nieuwe gebruiker start een wizard om een programma te genereren, waarbij de AI methodes dynamisch over de gekozen dagen verdeelt. Gebruikers kunnen dit schema aanpassen. Het systeem ondersteunt het plannen van toekomstige programma's en voorkomt overlappingen. Handmatige programma-creatie is ook mogelijk.

Problemen:

De AI kiest willekeurige methodes als de data niet "opgeruimd" is.

De berekening van de totale trainingstijd is nog niet accuraat, omdat de duur van methodes willekeurig wordt samengesteld.

De naamgeving van programma's is nog niet definitief.

Een aangemaakt programma in de webbrowser verdwijnt na installatie van de app als het niet expliciet wordt opgeslagen.

De waarschuwingstekst bij het plannen van een overlappend programma moet duidelijker.

Een blauw scherm na het aanmaken van een programma is een bug.

Plan:

De AI-aansturing verbeteren om te zorgen dat de geselecteerde data correct is. -- [Speaker 1]

Nadenken over de naamgeving van programma's, eventueel via AI-gegenereerde namen. -- [Speaker 1]

De logica en instructies voor het opbouwen van programma's nakijken. -- [Speaker 1]

1.3 Scoresysteem, Gamification en Doelbeheer - Rapporteur: [Speaker 1], [Speaker 3]
Voortgang: De homepage toont het actieve programma en drie scores: Mental Fitness, Persoonlijke Doelen en Goede Gewoontes. Gebruikers verdienen 10 punten per voltooide oefening en 5 punten voor dagelijkse 'goede gewoontes'. Extra bonuspunten worden toegekend voor mijlpalen, en een beloningssysteem met badges (van 'ontdekker' tot 'mentale atleet') is aanwezig. Een 'streak'-functie telt opeenvolgende actieve dagen. De mental fitness score wordt niet gereset bij een nieuw programma en een waarschuwing wordt gegeven voordat de score na 3 maanden inactiviteit vervalt. Gebruikers kunnen persoonlijke doelen toevoegen, die bij voltooiing 10 punten opleveren.

Problemen:

Er is een bug waarbij punten onterecht worden toegekend.

De score van persoonlijke doelen wordt nog niet correct opgeteld bij de totale mentale score.

Het plus-icoon (+) voor het afvinken van een persoonlijk doel is verwarrend.

Het onderscheid tussen 'beginner' en 'gevorderd' is nog niet geïmplementeerd.

Plan:

De bug met onterecht toegekende punten corrigeren. -- [Speaker 1]

Een bugfix uitvoeren zodat de score van persoonlijke doelen correct wordt opgeteld. -- [Speaker 1]

Het plus-icoon voor voltooide persoonlijke doelen vervangen door een vinkje. -- [Speaker 1]

Overwegen om gebruikersniveaus (bv. 'gevorderd') te implementeren op basis van voltooide oefeningen. -- [Team]

1.4 UI/UX en Feature Ideeën - Rapporteur: [Speaker 2], [Speaker 3]
Voortgang: Er is een filterfunctie in de bibliotheek op basis van doelstelling en duur.

Problemen:

De onboarding en interface zijn onduidelijk voor nieuwe gebruikers; 'activiteit van vandaag' moet prominenter en knoppen moeten logischer geplaatst worden.

Video's op mobiel gaan automatisch naar volledig scherm, en het sluiten ervan is omslachtig.

Gebruikers kunnen geen methode direct vanuit de bibliotheek aan hun programma toevoegen.

De interface kan traag reageren door het gebruik van Airtable.

Plan:

De UX/onboarding flow verbeteren met visuele aanpassingen en meer duiding. -- [Speaker 1]

Het afspeelgedrag van video's aanpassen zodat ze binnen de pagina afspelen. -- [Speaker 1]

Een knop 'Voeg toe aan mijn programma' toevoegen in de bibliotheek.

Mooie beelden/foto's toevoegen voor elke methode.

1.5 Toekomstige Ontwikkeling: HR Dashboard en Stand-alone App - Rapporteur: [Speaker 1]
Plan:

Een HR-dashboard ontwikkelen dat geanonimiseerde teamdata toont (inlogmomenten, voortgang) zonder persoonlijke doelen prijs te geven. -- [Team]

De mogelijkheid onderzoeken om de PWA te evolueren naar een volwaardige stand-alone app (Play Store/App Store), eventueel met een eigen database voor betere prestaties. -- [Team]

Nadenken over de strategische roadmap: de huidige versie finaliseren of direct een meer geavanceerde versie plannen. -- [Team]

2. Content, Testen en Implementatie
De focus verschuift naar het vullen van de app met kwalitatieve en 'snackable' content. De app wordt voorbereid voor een testfase met een selecte, geëngageerde pilotgroep. Tijdens eerste interne tests zijn al diverse bugs en UX-problemen aan het licht gekomen.

2.1 Contentcreatie en Meertaligheid - Rapporteur: [Speaker 3], [Speaker 1]
Problemen:

Cruciale content (doelstellingen, oefeningen, audio/video) is nog niet volledig ingevuld.

De inhoudelijke correctheid van AI-voorgestelde oefeningen is nog niet gegarandeerd.

De app ondersteunt technisch meerdere talen (NL, FR, EN), maar de Engelse vertaling en bijbehorend audiomateriaal zijn nog niet beschikbaar.

Plan:

Een serieuze overlegsessie plannen om de content (oefeningen, methodes) voor de app te bepalen. -- Team

AI gebruiken om suggesties uit opgenomen sessies te extraheren als input. -- [Speaker 5]

Taalversies implementeren zodra de basisfunctionaliteit af is. -- [Speaker 1]

2.2 Teststrategie en Feedback - Rapporteur: [Speaker 1], [Speaker 3], [Speaker 5]
Voortgang: Er is een testlink beschikbaar. Gebruikersbeheer is vereenvoudigd om toegang te verlenen aan testers. [Speaker 5] en [Speaker 3] zullen de app actief testen en feedback geven.

Problemen:

Een bug zorgde ervoor dat een voltooide, toekomstig geplande activiteit incorrect werd behandeld na een aanpassing.

Bij het herberekenen van een programma na het voltooien van een toekomstige activiteit (edge case) wordt de voortgang incorrect teruggezet naar 0%.

Plan:

Gebruikers (inclusief Dominique en Geert) toevoegen aan de database voor testdoeleinden. -- [Speaker 3], [Speaker 1]

Een kleine, geëngageerde groep van een goede klant (bv. Prana) selecteren voor de pilotfase. -- Team

De bug waarbij de voortgang naar 0% wordt teruggezet bij herberekening (edge case) onderzoeken en corrigeren. -- [Speaker 1]

De functionaliteit voor het behandelen van voltooide, toekomstig geplande taken nakijken. -- [Speaker 1]

3. Commercieel Model en Klantcase (Nationale Bank)
Het businessmodel wordt besproken, met een specifieke case voor de Nationale Bank die levenslange toegang tot materiaal vereist zonder abonnementsmodel. Dit leidt tot een discussie over een eenmalig dagtarief en het maken van een uitzondering, wat een concurrentieel voordeel kan zijn. Voor andere klanten wordt een jaarlijks betalend model overwogen. Verder is het idee geopperd om de app, indien succesvol, ook aan particulieren te verkopen.

Plan:

Een product ontwikkelen dat binnen twee tot vier weken klaar is voor gebruik en facturatie bij de klant Multifarma. -- Team (deadline: maart)

Voor de Nationale Bank een uitzondering met onbeperkte toegang overwegen. -- [Speaker 3], [Speaker 2]

Een beslissing nemen over de standaard toegangsduur van de app voor andere klanten (suggestie: 1 jaar). -- [Speaker 3]

AI Suggesties

AI heeft de volgende problemen geïdentificeerd die in de vergaderingen niet zijn afgesloten of waarvoor duidelijke actiepunten ontbreken; gelieve hier aandacht aan te besteden:

Onvolledige Content en AI-aansturing: Er is een dringende behoefte aan content (methodes, oefeningen, prompts per doelstelling). Er is een "serieuze overlegsessie" voorgesteld, maar er is geen concrete datum of eigenaar vastgelegd, wat de deadlines in gevaar brengt. Daarnaast kiest de AI "random dingen" als de data niet is opgeschoond, maar concrete stappen om dit te verbeteren ontbreken.

Technische Bugs en UX-problemen: Er zijn meerdere kritieke problemen vastgesteld: een niet-functionerende wachtwoord-inlogflow, een verwarrende onboarding, incorrecte scoreberekeningen, en problemen met de programma-voortgang bij edge cases. Hoewel er toezeggingen zijn om dit op te lossen, ontbreken concrete deadlines en testplannen.

Onduidelijke Strategische Beslissingen: Belangrijke besluiten blijven open: de strategische roadmap (huidige versie finaliseren vs. direct evolueren), de definitieve criteria voor gebruikersniveaus ('beginner' vs. 'gevorderd'), het standaard commerciële model voor de app, en of gebruikers meerdere programma's tegelijk kunnen volgen. Het gebrek aan definitieve keuzes bemoeilijkt de verdere ontwikkeling.

3. Commercieel Model en Klantcase (Nationale Bank)
2. Content, Testen en Implementatie
1. App Ontwikkeling en Functionaliteit
01-30 demo fitness-app