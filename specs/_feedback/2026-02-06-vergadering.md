02-06 Vergadering: App Functionaliteit, UI/UX en Technologische Ontwikkeling
1. Productfunctionaliteit en UI/UX
De functionaliteit van de app, met name rond overtuigingen, programma's en scoring, is grotendeels compleet. De focus ligt nu op het oplossen van een implementatiefout in de logica van overtuigingsniveaus en het doorvoeren van diverse UI-verbeteringen voor een betere gebruikerservaring, zoals het aanpassen van de kleur van vinkjes en de weergave van voltooide taken.

1.1 Logica Overtuigingsniveaus en Scoring - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

Voortgang

De huidige implementatie vereist dat een gebruiker een overtuiging drie keer registreert (niveau 1, 2, 3) om deze als voltooid te markeren en punten te verdienen, wat niet de bedoeling was.

Het oorspronkelijke idee: overtuigingen hebben niveaus (1, 2, 3) waar de gebruiker doorheen gaat; niet dezelfde overtuiging driemaal registreren.

Gebruikers moeten een overtuiging kunnen trainen en zelf kunnen aangeven wanneer deze is "ingeprint" (voltooid).

Afronden van een ingeprente overtuiging geeft 1 punt in de mentale fitness score.

Huidige formule voor de mentale fitness score: (methodegebruik x 10) + bonuspunten mijlpalen + overtuigingengebruik (count).

Probleem

De logica waarbij een overtuiging drie keer geregistreerd moet worden, is incorrect en verwarrend. Het "niveau" moet de overtuiging zelf zijn, niet het aantal registraties.

De formule voor de mentale fitness score hield per abuis rekening met een deling door 3 vanwege de foute implementatie.

Plan

Logica van overtuigingsniveaus aanpassen zodat gebruikers een overtuiging één keer kunnen voltooien. -- [Speaker 1]

Formule voor de mentale fitness score corrigeren zodat er niet meer door 3 wordt gedeeld. -- [Speaker 1]

Gebruikers in staat stellen om overtuigingen los van programma's af te handelen en hiervoor punten te krijgen in de mentale fitness score. -- [Speaker 1]

1.2 UI-aanpassingen - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

Voortgang

In de huidige UI zijn vinkjes voor nog niet voltooide taken al groen, wat verwarrend is.

De lijst met overtuigingen binnen een programma kan erg lang worden als voltooide items blijven staan.

De huidige versie, inclusief de UI-problemen, staat al online met hardere cashbusting.

Probleem

Groene vinkjes suggereren dat taken al voltooid zijn, wat niet het geval is. Dit werd als verwarrend ervaren.

Een lange lijst met voltooide en actieve overtuigingen door elkaar is onoverzichtelijk.

Plan

UI aanpassen zodat vinkjes voor onvoltooide taken grijs zijn en groen worden bij het aanvinken (voltooien). -- [Speaker 1]

Korte instructietekst toevoegen: "Print in met de balansmethode. Indien je print in met de balansmethode, zet een vinkje." -- [Speaker 2]

Een "bekijk voltooide" knop implementeren onder de actieve overtuigingen, standaard ingeklapt. -- [Speaker 1]

1.3 Content en datakoppeling (Airtable) - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

In de mindset-sectie zijn momenteel maar twee categorieën zichtbaar omdat nog niet alle overtuigingen gekoppeld zijn aan een doelstelling. De app haalt de data rechtstreeks uit Airtable; zodra de koppeling tussen doelstellingen en categorieën daar is gemaakt, zal dit in de app correct getoond worden. [Speaker 2] plant dit het komende weekend te doen.

1.4 Programmafunctionaliteit en notificaties - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

Het volledige programma is nu aanpasbaar (herplannen schema, toevoegen/verwijderen van overtuigingen). Er is echter nog geen notificatie/reminder-functionaliteit (pop-up) geïmplementeerd om gebruikers te herinneren aan hun dagelijkse taken. Dit moet nog worden toegevoegd als app-melding. Een reset van de score na een maand inactiviteit moet ook nog worden toegevoegd voor de lancering.

2. Technologische ontwikkeling en workflow
De ontwikkeling wordt aanzienlijk versneld door het gebruik van AI-codingbots en een gestructureerde, gedocumenteerde workflow. Dit omvat modulaire development, het gebruik van zelfgebouwde tools om efficiëntie te verhogen (zoals een Field ID Viewer en browserwisselaar), en het verkennen van nieuwe technologieën zoals Remotion en Sora voor toekomstige gepersonaliseerde content.

2.1 Development-workflow met AI - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

Voortgang

Development gebeurt met AI-codingbots (zoals de nieuwste Opus), wat de doorlooptijd aanzienlijk verkort.

Er is een gestructureerde workflow: elke functionaliteit als klein, gedocumenteerd blokje (implementatieplan en requirements). Dit plan fungeert als "geheugen" voor de AI-bot.

Code staat op GitHub met een kopie lokaal en op de server, waardoor er geen risico op dataverlies is.

Documentatie wordt continu up-to-date gehouden, zodat de hele app in principe opnieuw kan worden gecodeerd door een AI-bot.

Eigen macOS-app "Better Openlink Pro" gebouwd om snel tussen browsers (Edge en Chrome) te wisselen.

Eigen Airtable-plugin (Airtable Field ID Viewer) gebouwd om snel Field ID's te kopiëren, wat helpt bij het debuggen van mappingproblemen.

Probleem

AI-bots kunnen hun geheugen verliezen en inconsistent worden zonder een duidelijk, uitgeschreven plan om op terug te vallen.

Een bug in een eerdere testversie (overtuigingen verkeerd gemapt) werd veroorzaakt door een fout van ChatGPT die Field ID's mixte. Dit kon snel worden opgelost met de Field ID Viewer.

2.2 Verkenning nieuwe technologieën - Rapporteur: [Speaker 1]
--Deelnemen aan discussie: [Speaker 2]

Voortgang

Idee van gepersonaliseerde ontspanningsoefeningen (audio/video) wordt besproken.

Technisch haalbaar met video-coding API Remotion en 11Labs API voor stemklonen en invoegen van gebruikersnamen.

Test gedaan met Sora van OpenAI; heeft nu een API en kan Vlaams spreken, een optie voor video's zonder "Hollandse stijl".

Probleem

Kosten voor video-generatie met Sora zijn nog onbekend en moeten worden onderzocht.

Door Sora gegenereerde Vlaamse spraak is nog wat hakkerig en niet volledig vloeiend.

AI-suggesties

AI heeft de volgende problemen geïdentificeerd die in de vergadering niet zijn afgerond of waarvoor duidelijke actiepunten ontbreken; gelieve hier aandacht aan te besteden:

Ontbrekende notificaties en score-reset: Er zijn dagelijkse pop-up notificaties voor taken nodig en de score van een gebruiker moet op nul vallen na een maand inactiviteit. Beide features zijn cruciaal voor gebruikersbetrokkenheid en moeten vóór de lancering worden ingepland. Onzeker wie dit oppakt en wanneer het gereed is.

Onvolledige content-koppeling: De app toont momenteel onvolledige data (bv. maar 2 mindset-categorieën) omdat de koppeling tussen doelstellingen en categorieën in Airtable nog niet is afgerond. [Speaker 2] kijkt hier "van het weekend" naar; dit is een kritieke afhankelijkheid voor testen en een realistische gebruikerservaring. Een concretere deadline en opvolging zijn aan te raden.

Toekomstvisie gepersonaliseerde content: Het idee om gepersonaliseerde audio/video-oefeningen te maken met Remotion en Sora is technisch haalbaar, maar blijft vaag. Er is geen beslissing over het starten van een pilot of verdere uitwerking. Kosten en kwaliteit van Sora zijn belangrijke onbekende factoren die vervolgonderzoek vereisen.