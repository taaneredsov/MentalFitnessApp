#!/usr/bin/env node
/**
 * One-time script to create the Vertalingen (Translations) table in Airtable
 * and populate it with all translation keys and Dutch values.
 *
 * Usage: node scripts/create-translations-table.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN = process.env.AIRTABLE_ACCESS_TOKEN;

if (!BASE_ID || !TOKEN) {
  console.error('Missing AIRTABLE_BASE_ID or AIRTABLE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// All translation keys with Dutch values
const translations = [
  // ============================================================
  // AUTH - LOGIN
  // ============================================================
  { key: "auth.login.title", nl: "Welkom", context: "LoginPage - main title" },
  { key: "auth.login.password.title", nl: "Wachtwoord", context: "LoginPage - password step title" },
  { key: "auth.login.email.label", nl: "E-mailadres", context: "LoginPage - email field label" },
  { key: "auth.login.email.placeholder", nl: "jouw@email.com", context: "LoginPage - email placeholder" },
  { key: "auth.login.password.label", nl: "Wachtwoord", context: "LoginPage - password field label" },
  { key: "auth.login.continue", nl: "Doorgaan", context: "LoginPage - continue button" },
  { key: "auth.login.checking", nl: "Controleren...", context: "LoginPage - checking state" },
  { key: "auth.login.submit", nl: "Inloggen", context: "LoginPage - submit button" },
  { key: "auth.login.submitting", nl: "Inloggen...", context: "LoginPage - submitting state" },
  { key: "auth.login.magicLink", nl: "Inloggen met email link", context: "LoginPage - magic link option" },
  { key: "auth.login.withPassword", nl: "Inloggen met wachtwoord", context: "MagicLinkPage - password option" },

  // ============================================================
  // AUTH - MAGIC LINK
  // ============================================================
  { key: "auth.magicLink.title", nl: "Inloggen", context: "MagicLinkPage - title" },
  { key: "auth.magicLink.description", nl: "Voer je email adres in om een login link te ontvangen", context: "MagicLinkPage - description" },
  { key: "auth.magicLink.placeholder", nl: "je@email.com", context: "MagicLinkPage - email placeholder" },
  { key: "auth.magicLink.submit", nl: "Stuur login link", context: "MagicLinkPage - submit button" },
  { key: "auth.magicLink.footer", nl: "Je ontvangt een email met een link en code om in te loggen.\nGeen account? Neem contact op met je beheerder.", context: "MagicLinkPage - footer text" },
  { key: "auth.magicLink.sent.title", nl: "Check je email", context: "MagicLinkPage - sent state title" },
  { key: "auth.magicLink.sent.description", nl: "We hebben een login link gestuurd naar", context: "MagicLinkPage - sent description" },
  { key: "auth.magicLink.sent.instruction1", nl: "Klik op de link in de email om in te loggen.", context: "MagicLinkPage - instruction 1" },
  { key: "auth.magicLink.sent.instruction2", nl: "Gebruik je de app op je telefoon? Voer dan de code in.", context: "MagicLinkPage - instruction 2" },
  { key: "auth.magicLink.sent.enterCode", nl: "Code invoeren", context: "MagicLinkPage - enter code link" },
  { key: "auth.magicLink.sent.changeEmail", nl: "Ander email adres gebruiken", context: "MagicLinkPage - change email link" },
  { key: "auth.magicLink.error", nl: "Er ging iets mis. Probeer het opnieuw.", context: "MagicLinkPage - error message" },

  // ============================================================
  // AUTH - VERIFY CODE
  // ============================================================
  { key: "auth.verifyCode.title", nl: "Voer code in", context: "VerifyCodePage - title" },
  { key: "auth.verifyCode.description", nl: "We hebben een 6-cijferige code gestuurd naar", context: "VerifyCodePage - description" },
  { key: "auth.verifyCode.requestNew", nl: "Nieuwe code aanvragen", context: "VerifyCodePage - request new code" },
  { key: "auth.verifyCode.backToLogin", nl: "Terug naar inloggen", context: "VerifyCodePage - back link" },
  { key: "auth.verifyCode.validity", nl: "De code is 15 minuten geldig", context: "VerifyCodePage - validity note" },
  { key: "auth.verifyCode.error.invalid", nl: "Ongeldige of verlopen code", context: "VerifyCodePage - invalid code error" },

  // ============================================================
  // AUTH - VERIFY TOKEN
  // ============================================================
  { key: "auth.verifyToken.verifying", nl: "Even geduld, je wordt ingelogd...", context: "VerifyTokenPage - loading state" },
  { key: "auth.verifyToken.error.title", nl: "Link ongeldig", context: "VerifyTokenPage - error title" },
  { key: "auth.verifyToken.error.noToken", nl: "Geen geldige link", context: "VerifyTokenPage - no token error" },
  { key: "auth.verifyToken.error.expired", nl: "Link is ongeldig of verlopen", context: "VerifyTokenPage - expired error" },
  { key: "auth.verifyToken.requestNew", nl: "Nieuwe link aanvragen", context: "VerifyTokenPage - request new link" },
  { key: "auth.verifyToken.validity", nl: "Links zijn 15 minuten geldig en kunnen maar 1x gebruikt worden", context: "VerifyTokenPage - validity note" },

  // ============================================================
  // AUTH - SET PASSWORD
  // ============================================================
  { key: "auth.setPassword.title", nl: "Kies je wachtwoord", context: "SetPasswordPage - title" },
  { key: "auth.setPassword.description", nl: "We hebben een verificatiecode gestuurd naar", context: "SetPasswordPage - description" },
  { key: "auth.setPassword.code.label", nl: "Verificatiecode", context: "SetPasswordPage - code label" },
  { key: "auth.setPassword.code.placeholder", nl: "000000", context: "SetPasswordPage - code placeholder" },
  { key: "auth.setPassword.password.label", nl: "Wachtwoord", context: "SetPasswordPage - password label" },
  { key: "auth.setPassword.password.placeholder", nl: "Minimaal 8 tekens", context: "SetPasswordPage - password placeholder" },
  { key: "auth.setPassword.confirmPassword.label", nl: "Bevestig wachtwoord", context: "SetPasswordPage - confirm password label" },
  { key: "auth.setPassword.confirmPassword.placeholder", nl: "Herhaal je wachtwoord", context: "SetPasswordPage - confirm password placeholder" },
  { key: "auth.setPassword.submit", nl: "Wachtwoord instellen", context: "SetPasswordPage - submit button" },
  { key: "auth.setPassword.submitting", nl: "Bezig...", context: "SetPasswordPage - submitting state" },

  // ============================================================
  // AUTH - FIRST TIME USER
  // ============================================================
  { key: "auth.firstTimeUser.title", nl: "Eerste Keer?", context: "FirstTimeUserPage - title" },
  { key: "auth.firstTimeUser.description", nl: "Voer je e-mailadres in om je account te activeren", context: "FirstTimeUserPage - description" },
  { key: "auth.firstTimeUser.email.label", nl: "E-mailadres", context: "FirstTimeUserPage - email label" },
  { key: "auth.firstTimeUser.email.placeholder", nl: "jouw@email.com", context: "FirstTimeUserPage - email placeholder" },
  { key: "auth.firstTimeUser.submit", nl: "Doorgaan", context: "FirstTimeUserPage - submit button" },
  { key: "auth.firstTimeUser.submitting", nl: "Controleren...", context: "FirstTimeUserPage - submitting state" },
  { key: "auth.firstTimeUser.hasAccount", nl: "Heb je al een wachtwoord?", context: "FirstTimeUserPage - has account text" },
  { key: "auth.firstTimeUser.loginLink", nl: "Inloggen", context: "FirstTimeUserPage - login link" },
  { key: "auth.firstTimeUser.error.hasPassword", nl: "Dit account heeft al een wachtwoord. Ga naar de inlogpagina.", context: "FirstTimeUserPage - already has password error" },

  // ============================================================
  // VALIDATION - AUTH
  // ============================================================
  { key: "validation.email.invalid", nl: "Voer een geldig e-mailadres in", context: "Email validation error" },
  { key: "validation.password.required", nl: "Wachtwoord is verplicht", context: "Password required error" },
  { key: "validation.setPassword.code.length", nl: "Voer de 6-cijferige code in", context: "SetPassword - code validation" },
  { key: "validation.setPassword.password.minLength", nl: "Wachtwoord moet minimaal 8 tekens zijn", context: "SetPassword - password min length" },
  { key: "validation.setPassword.confirmPassword.required", nl: "Bevestig je wachtwoord", context: "SetPassword - confirm required" },
  { key: "validation.setPassword.passwordMismatch", nl: "Wachtwoorden komen niet overeen", context: "SetPassword - mismatch error" },
  { key: "validation.password.minLength", nl: "Wachtwoord moet minimaal 8 tekens zijn", context: "ChangePassword - min length" },
  { key: "validation.password.confirm", nl: "Bevestig je wachtwoord", context: "ChangePassword - confirm required" },
  { key: "validation.password.mismatch", nl: "Wachtwoorden komen niet overeen", context: "ChangePassword - mismatch error" },

  // ============================================================
  // NAVIGATION
  // ============================================================
  { key: "nav.home", nl: "Home", context: "BottomNav - home tab" },
  { key: "nav.programs", nl: "Programma", context: "BottomNav - programs tab" },
  { key: "nav.methods", nl: "Methodes", context: "BottomNav - methods tab" },
  { key: "nav.mindset", nl: "Mindset", context: "BottomNav - mindset tab" },
  { key: "nav.account", nl: "Account", context: "BottomNav - account tab" },

  // ============================================================
  // HEADER
  // ============================================================
  { key: "header.appName", nl: "Mental Fitness", context: "AppHeader - app name" },
  { key: "header.subtitle", nl: "by Prana Mental Excellence", context: "AppHeader - subtitle" },
  { key: "header.logout", nl: "Logout", context: "AppHeader - logout button" },

  // ============================================================
  // COMMON
  // ============================================================
  { key: "common.back", nl: "Terug", context: "Shared - back button" },
  { key: "common.cancel", nl: "Annuleren", context: "Shared - cancel button" },
  { key: "common.save", nl: "Opslaan", context: "Shared - save button" },
  { key: "common.skip", nl: "Overslaan", context: "Shared - skip button" },
  { key: "common.loading", nl: "Laden...", context: "Shared - loading state" },
  { key: "common.retry", nl: "Opnieuw proberen", context: "Shared - retry button" },
  { key: "common.close", nl: "Sluiten", context: "Shared - close button" },

  // ============================================================
  // HOME PAGE
  // ============================================================
  { key: "home.welcome.title", nl: "Hello, {{firstName}}!", context: "HomePage - welcome title (interpolation)" },
  { key: "home.welcome.subtitle", nl: "Welkom bij je persoonlijke mentale fitness-coach.", context: "HomePage - welcome subtitle" },
  { key: "home.welcome.returning", nl: "Welkom terug, {{firstName}}!", context: "HomePage - returning user greeting" },
  { key: "home.welcome.first", nl: "Welkom, {{firstName}}!", context: "HomePage - first time greeting" },
  { key: "home.welcome.firstDescription", nl: "Laten we je eerste programma maken om te beginnen met je mentale fitness reis.", context: "HomePage - first time description" },

  { key: "home.activity.today", nl: "Activiteit van Vandaag", context: "HomePage - today's activity section" },
  { key: "home.activity.next", nl: "Volgende Activiteit", context: "HomePage - next activity" },
  { key: "home.activity.totalTime", nl: "Totaal: {{time}} minuten", context: "HomePage - total time (interpolation)" },
  { key: "home.activity.completed", nl: "Afgerond", context: "HomePage - completed status" },

  { key: "home.program.current", nl: "Huidig Programma", context: "HomePage - current program section" },
  { key: "home.program.progress", nl: "Voortgang", context: "HomePage - progress label" },
  { key: "home.program.frequency", nl: "{{frequency}}x per week", context: "HomePage - frequency (interpolation)" },
  { key: "home.program.none.title", nl: "Geen Actief Programma", context: "HomePage - no program title" },
  { key: "home.program.none.description", nl: "Je hebt momenteel geen actief programma. Bekijk je programma's om te starten.", context: "HomePage - no program description" },

  { key: "home.activeProgram.title", nl: "Je hebt al een actief programma", context: "HomePage - active program limit title" },
  { key: "home.activeProgram.description", nl: "Je kunt slechts één programma tegelijk volgen. Voltooi of bewerk je huidige programma eerst.", context: "HomePage - active program limit description" },
  { key: "home.activeProgram.view", nl: "Bekijk huidig programma", context: "HomePage - view current program button" },

  { key: "home.help.title", nl: "Hulp & Informatie", context: "HomePage - help section title" },
  { key: "home.help.description", nl: "Heb je vragen over de app of je mentale fitnessprogramma? Hier vind je antwoorden.", context: "HomePage - help section description" },
  { key: "home.help.points.question", nl: "Hoe werkt het puntensysteem?", context: "HomePage - FAQ question" },
  { key: "home.help.points.answer", nl: "Verdien punten door methodes te voltooien (10 pts), gewoontes bij te houden (5 pts) en persoonlijke doelen te behalen (10 pts).", context: "HomePage - FAQ answer" },
  { key: "home.help.streak.question", nl: "Wat is een streak?", context: "HomePage - FAQ question" },
  { key: "home.help.streak.answer", nl: "Je streak telt het aantal opeenvolgende dagen dat je actief bent geweest. Blijf elke dag bezig om je streak te behouden!", context: "HomePage - FAQ answer" },
  { key: "home.help.edit.question", nl: "Kan ik mijn programma aanpassen?", context: "HomePage - FAQ question" },
  { key: "home.help.edit.answer", nl: "Ja! Ga naar je programma details en tik op \"Bewerk programma\" om doelen, trainingsdagen of notities te wijzigen.", context: "HomePage - FAQ answer" },

  // ============================================================
  // GUIDED TOUR
  // ============================================================
  { key: "tour.activity.content", nl: "Dit is je belangrijkste taak voor vandaag. Tik op een oefening om te beginnen.", context: "GuidedTour - activity step" },
  { key: "tour.scores.content", nl: "Hier zie je je punten en streak. Blijf actief om je score te verhogen!", context: "GuidedTour - scores step" },
  { key: "tour.progress.content", nl: "Volg hier je voortgang. Tik om je volledige programma te bekijken.", context: "GuidedTour - progress step" },
  { key: "tour.goals.content", nl: "Stel persoonlijke doelen om extra gemotiveerd te blijven.", context: "GuidedTour - goals step" },
  { key: "tour.habits.content", nl: "Bouw goede gewoontes op met dagelijkse check-ins.", context: "GuidedTour - habits step" },
  { key: "tour.navigation.content", nl: "Navigeer hier naar je programma's, alle methodes, of je account-instellingen.", context: "GuidedTour - navigation step" },

  // ============================================================
  // ONBOARDING / WELCOME
  // ============================================================
  { key: "onboarding.welcome.title", nl: "Nieuw programma maken", context: "WelcomeScreen - title" },
  { key: "onboarding.welcome.subtitle", nl: "In een paar stappen maken we samen een programma dat bij jou past.", context: "WelcomeScreen - subtitle" },
  { key: "onboarding.welcome.step1.title", nl: "Stap 1", context: "WelcomeScreen - step 1 title" },
  { key: "onboarding.welcome.step1.description", nl: "Vertel ons wat je wilt bereiken", context: "WelcomeScreen - step 1 description" },
  { key: "onboarding.welcome.step2.title", nl: "Stap 2", context: "WelcomeScreen - step 2 title" },
  { key: "onboarding.welcome.step2.description", nl: "Kies wanneer het jou uitkomt", context: "WelcomeScreen - step 2 description" },
  { key: "onboarding.welcome.step3.title", nl: "Stap 3", context: "WelcomeScreen - step 3 title" },
  { key: "onboarding.welcome.step3.description", nl: "Krijg je persoonlijke plan", context: "WelcomeScreen - step 3 description" },
  { key: "onboarding.welcome.disclaimer", nl: "Geen zorgen - je kunt je keuzes later altijd aanpassen.", context: "WelcomeScreen - disclaimer" },
  { key: "onboarding.welcome.duration", nl: "Dit duurt ongeveer 2 minuten.", context: "WelcomeScreen - duration note" },
  { key: "onboarding.welcome.start", nl: "Maak mijn programma", context: "WelcomeScreen - start button" },

  // ============================================================
  // PROGRAMS PAGE
  // ============================================================
  { key: "programs.title", nl: "Programma's", context: "ProgramsPage - page title" },
  { key: "programs.new", nl: "Nieuw Programma", context: "ProgramsPage - new program button" },
  { key: "programs.none", nl: "Je hebt nog geen programma's.", context: "ProgramsPage - empty state" },
  { key: "programs.createFirst", nl: "Maak je eerste programma", context: "ProgramsPage - create first CTA" },
  { key: "programs.error", nl: "Kon programma's niet laden", context: "ProgramsPage - error state" },

  { key: "programs.section.running", nl: "Actief", context: "ProgramsPage - active section" },
  { key: "programs.section.planned", nl: "Gepland", context: "ProgramsPage - planned section" },
  { key: "programs.section.finished", nl: "Afgerond", context: "ProgramsPage - finished section" },

  { key: "programs.new.title", nl: "Nieuw Programma", context: "ProgramsPage - new program dialog title" },
  { key: "programs.new.description", nl: "Hoe wil je je programma samenstellen?", context: "ProgramsPage - new program dialog description" },
  { key: "programs.new.ai.title", nl: "Automatisch Programma (Aanbevolen)", context: "ProgramsPage - AI option title" },
  { key: "programs.new.ai.description", nl: "Laat automatisch een gepersonaliseerd schema maken op basis van je doelen", context: "ProgramsPage - AI option description" },
  { key: "programs.new.ai.wizardDescription", nl: "Laat automatisch een gepersonaliseerd programma voor je maken.", context: "ProgramsPage - AI wizard description" },
  { key: "programs.new.manual.title", nl: "Handmatig Samenstellen", context: "ProgramsPage - manual option title" },
  { key: "programs.new.manual.description", nl: "Stel zelf je programma samen stap voor stap", context: "ProgramsPage - manual option description" },
  { key: "programs.new.manual.wizardDescription", nl: "Maak stap voor stap je eigen programma.", context: "ProgramsPage - manual wizard description" },

  { key: "programs.status.running", nl: "Actief", context: "ProgramDetailPage - active status badge" },
  { key: "programs.status.planned", nl: "Gepland", context: "ProgramDetailPage - planned status badge" },
  { key: "programs.status.finished", nl: "Afgerond", context: "ProgramDetailPage - finished status badge" },

  // ============================================================
  // PROGRAM DETAIL PAGE
  // ============================================================
  { key: "programDetail.title", nl: "Programma Details", context: "ProgramDetailPage - page title" },
  { key: "programDetail.edit", nl: "Bewerk programma", context: "ProgramDetailPage - edit button" },
  { key: "programDetail.error", nl: "Kon programma niet laden", context: "ProgramDetailPage - error state" },
  { key: "programDetail.notFound", nl: "Programma niet gevonden", context: "ProgramDetailPage - not found" },

  { key: "programDetail.overview.title", nl: "Overzicht", context: "ProgramDetailPage - overview section" },
  { key: "programDetail.overview.period", nl: "Periode", context: "ProgramDetailPage - period label" },
  { key: "programDetail.overview.duration", nl: "Duur", context: "ProgramDetailPage - duration label" },
  { key: "programDetail.overview.frequency", nl: "Frequentie", context: "ProgramDetailPage - frequency label" },
  { key: "programDetail.overview.sessionTime", nl: "Tijd per sessie", context: "ProgramDetailPage - session time label" },
  { key: "programDetail.overview.sessionTime.minutes", nl: "{{min}} - {{max}} minuten", context: "ProgramDetailPage - session time value" },

  { key: "programDetail.goals.title", nl: "Doelstellingen", context: "ProgramDetailPage - goals section" },
  { key: "programDetail.methods.title", nl: "Methodes", context: "ProgramDetailPage - methods section" },
  { key: "programDetail.activities.title", nl: "Recente Activiteiten", context: "ProgramDetailPage - activities section" },
  { key: "programDetail.notes.title", nl: "Notities", context: "ProgramDetailPage - notes section" },
  { key: "programDetail.overtuigingen.title", nl: "Overtuigingen", context: "ProgramDetailPage - overtuigingen section" },

  // ============================================================
  // METHODS PAGE
  // ============================================================
  { key: "methods.title", nl: "Methodes", context: "MethodsPage - page title" },
  { key: "methods.search.placeholder", nl: "Zoek methodes...", context: "MethodsPage - search placeholder" },
  { key: "methods.search.clear", nl: "Zoekopdracht wissen", context: "MethodsPage - clear search" },
  { key: "methods.error", nl: "Kon methodes niet laden", context: "MethodsPage - error state" },
  { key: "methods.filter.all", nl: "Alle", context: "MethodsPage - all filter" },
  { key: "methods.empty.search", nl: "Geen methodes gevonden voor deze zoekopdracht.", context: "MethodsPage - empty search" },
  { key: "methods.empty.filter", nl: "Geen methodes gevonden voor deze doelstelling.", context: "MethodsPage - empty filter" },
  { key: "methods.empty.combination", nl: "Geen methodes gevonden voor deze combinatie.", context: "MethodsPage - empty combination" },
  { key: "methods.empty.none", nl: "Geen methodes beschikbaar.", context: "MethodsPage - no methods" },
  { key: "methods.card.minutes", nl: "{{duration}} min", context: "Method card - duration" },

  // ============================================================
  // METHOD DETAIL PAGE
  // ============================================================
  { key: "methodDetail.back", nl: "Terug", context: "MethodDetailPage - back button" },
  { key: "methodDetail.completed", nl: "Afgerond", context: "MethodDetailPage - completed badge" },
  { key: "methodDetail.error", nl: "Kon methode niet laden", context: "MethodDetailPage - error state" },
  { key: "methodDetail.notFound", nl: "Methode niet gevonden", context: "MethodDetailPage - not found" },
  { key: "methodDetail.media.title", nl: "Media", context: "MethodDetailPage - media section" },
  { key: "methodDetail.media.completed", nl: "Afgerond", context: "MethodDetailPage - media completed" },
  { key: "methodDetail.media.audio.error", nl: "Je browser ondersteunt geen audio playback.", context: "MethodDetailPage - audio error" },
  { key: "methodDetail.media.video.error", nl: "Je browser ondersteunt geen video playback.", context: "MethodDetailPage - video error" },
  { key: "methodDetail.description.title", nl: "Beschrijving", context: "MethodDetailPage - description section" },
  { key: "methodDetail.technique.title", nl: "Techniek", context: "MethodDetailPage - technique section" },
  { key: "methodDetail.duration", nl: "{{duration}} minuten", context: "MethodDetailPage - duration" },

  // ============================================================
  // OVERTUIGINGEN PAGE
  // ============================================================
  { key: "overtuigingen.title", nl: "Overtuigingen", context: "OvertuigingenPage - page title" },
  { key: "overtuigingen.search.placeholder", nl: "Zoek overtuigingen...", context: "OvertuigingenPage - search placeholder" },
  { key: "overtuigingen.search.clear", nl: "Zoekopdracht wissen", context: "OvertuigingenPage - clear search" },
  { key: "overtuigingen.error.loading", nl: "Kon overtuigingen niet laden", context: "OvertuigingenPage - error loading" },
  { key: "overtuigingen.error.personal", nl: "Kon eigen overtuigingen niet laden", context: "OvertuigingenPage - error personal" },
  { key: "overtuigingen.filter.all", nl: "Alle", context: "OvertuigingenPage - all filter" },
  { key: "overtuigingen.filter.personal", nl: "Eigen overtuigingen", context: "OvertuigingenPage - personal filter" },
  { key: "overtuigingen.completed", nl: "Voltooid", context: "Overtuigingen - completed badge" },
  { key: "overtuigingen.showCompleted", nl: "Bekijk voltooide ({{count}})", context: "Overtuigingen - show completed toggle" },
  { key: "overtuigingen.hideCompleted", nl: "Verberg voltooide", context: "Overtuigingen - hide completed toggle" },
  { key: "overtuigingen.instruction", nl: "Programmeer de overtuiging met de balansmethode, en zet een vinkje wanneer afgerond.", context: "Overtuigingen - instruction text" },
  { key: "overtuigingen.empty.search", nl: "Geen overtuigingen gevonden voor deze zoekopdracht.", context: "OvertuigingenPage - empty search" },
  { key: "overtuigingen.empty.filter", nl: "Geen overtuigingen gevonden voor deze categorie.", context: "OvertuigingenPage - empty filter" },
  { key: "overtuigingen.empty.combination", nl: "Geen overtuigingen gevonden voor deze combinatie.", context: "OvertuigingenPage - empty combination" },
  { key: "overtuigingen.empty.none", nl: "Geen overtuigingen beschikbaar.", context: "OvertuigingenPage - no overtuigingen" },
  { key: "overtuigingen.section.title", nl: "Overtuigingen", context: "OvertuigingenSection - section title" },
  { key: "overtuigingen.section.add", nl: "Toevoegen", context: "OvertuigingenSection - add button" },
  { key: "overtuigingen.section.none", nl: "Geen overtuigingen. Voeg je eerste toe!", context: "OvertuigingenSection - empty state" },
  { key: "overtuigingen.section.personal", nl: "Persoonlijk", context: "OvertuigingenSection - personal badge" },

  // ============================================================
  // OVERTUIGINGEN DIALOGS
  // ============================================================
  { key: "overtuigingen.addDialog.title", nl: "Overtuiging toevoegen", context: "AddOvertuigingDialog - title" },
  { key: "overtuigingen.addDialog.description", nl: "Kies een overtuiging om aan je programma toe te voegen.", context: "AddOvertuigingDialog - description" },
  { key: "overtuigingen.addDialog.selectFromGoals", nl: "Kies uit overtuigingen bij jouw doelstellingen", context: "AddOvertuigingDialog - select from goals" },
  { key: "overtuigingen.addDialog.allAdded", nl: "Alle overtuigingen bij jouw doelstellingen zijn al toegevoegd.", context: "AddOvertuigingDialog - all added" },
  { key: "overtuigingen.addDialog.divider", nl: "of", context: "AddOvertuigingDialog - divider text" },
  { key: "overtuigingen.addDialog.addPersonal", nl: "Eigen overtuiging toevoegen", context: "AddOvertuigingDialog - add personal" },
  { key: "overtuigingen.addDialog.personalLabel", nl: "Eigen overtuiging", context: "AddOvertuigingDialog - personal label" },
  { key: "overtuigingen.addDialog.personalPlaceholder", nl: "bijv. Ik ben goed genoeg", context: "AddOvertuigingDialog - personal placeholder" },
  { key: "overtuigingen.addDialog.submit.single", nl: "{{count}} toevoegen", context: "AddOvertuigingDialog - submit single" },
  { key: "overtuigingen.addDialog.submit.multiple", nl: "{{count}} toevoegen", context: "AddOvertuigingDialog - submit multiple" },
  { key: "overtuigingen.addDialog.submit.default", nl: "Toevoegen", context: "AddOvertuigingDialog - submit default" },
  { key: "overtuigingen.addDialog.cancel", nl: "Annuleren", context: "AddOvertuigingDialog - cancel button" },

  { key: "overtuigingen.personalDialog.title", nl: "Nieuwe Persoonlijke Overtuiging", context: "PersoonlijkeOvertuigingDialog - title" },
  { key: "overtuigingen.personalDialog.description", nl: "Schrijf een persoonlijke overtuiging die je wilt versterken.", context: "PersoonlijkeOvertuigingDialog - description" },
  { key: "overtuigingen.personalDialog.nameLabel", nl: "Naam *", context: "PersoonlijkeOvertuigingDialog - name label" },
  { key: "overtuigingen.personalDialog.namePlaceholder", nl: "bijv. Ik ben goed genoeg", context: "PersoonlijkeOvertuigingDialog - name placeholder" },
  { key: "overtuigingen.personalDialog.submit", nl: "Toevoegen", context: "PersoonlijkeOvertuigingDialog - submit" },
  { key: "overtuigingen.personalDialog.cancel", nl: "Annuleren", context: "PersoonlijkeOvertuigingDialog - cancel" },

  // ============================================================
  // VALIDATION - OVERTUIGINGEN
  // ============================================================
  { key: "validation.overtuiging.nameRequired", nl: "Naam is verplicht", context: "Overtuiging validation - name required" },
  { key: "validation.overtuiging.nameMaxLength", nl: "Naam mag maximaal 200 karakters zijn", context: "Overtuiging validation - name max length" },
  { key: "validation.overtuiging.notLoggedIn", nl: "Je bent niet ingelogd", context: "Overtuiging validation - not logged in" },
  { key: "validation.overtuiging.error", nl: "Er is een fout opgetreden", context: "Overtuiging validation - generic error" },

  // ============================================================
  // ACCOUNT PAGE
  // ============================================================
  { key: "account.title", nl: "Account", context: "AccountPage - page title" },
  { key: "account.profile.title", nl: "Profiel", context: "AccountPage - profile section title" },
  { key: "account.profile.name", nl: "Naam", context: "AccountPage - name label" },
  { key: "account.profile.email", nl: "Email", context: "AccountPage - email label" },
  { key: "account.profile.company", nl: "Bedrijf", context: "AccountPage - company label" },
  { key: "account.profile.loading", nl: "Laden...", context: "AccountPage - profile loading" },
  { key: "account.profile.noCompany", nl: "Geen bedrijf gekoppeld", context: "AccountPage - no company" },

  { key: "account.rewards.title", nl: "Beloningen", context: "AccountPage - rewards section" },
  { key: "account.rewards.loading", nl: "Laden...", context: "AccountPage - rewards loading" },
  { key: "account.rewards.points", nl: "{{points}} punten", context: "AccountPage - points display" },
  { key: "account.rewards.badges", nl: "Badges", context: "AccountPage - badges label" },
  { key: "account.rewards.none", nl: "Geen beloningsgegevens beschikbaar", context: "AccountPage - no rewards" },

  { key: "account.notifications.title", nl: "Notificaties", context: "AccountPage - notifications section" },
  { key: "account.notifications.pushSupport", nl: "Push ondersteuning", context: "AccountPage - push support label" },
  { key: "account.notifications.pushSupported", nl: "Ondersteund", context: "AccountPage - supported" },
  { key: "account.notifications.pushUnsupported", nl: "Niet ondersteund", context: "AccountPage - not supported" },
  { key: "account.notifications.permission", nl: "Browser toestemming", context: "AccountPage - permission label" },
  { key: "account.notifications.loading", nl: "Notificatie-instellingen laden...", context: "AccountPage - notifications loading" },
  { key: "account.notifications.enabled", nl: "Herinneringen actief", context: "AccountPage - reminders active" },
  { key: "account.notifications.mode", nl: "Herinneringsmodus", context: "AccountPage - reminder mode label" },
  { key: "account.notifications.mode.session", nl: "Per sessie", context: "AccountPage - per session mode" },
  { key: "account.notifications.mode.dailySummary", nl: "Dagelijkse samenvatting", context: "AccountPage - daily summary mode" },
  { key: "account.notifications.mode.both", nl: "Beide", context: "AccountPage - both modes" },
  { key: "account.notifications.leadMinutes", nl: "Vooraankondiging (minuten)", context: "AccountPage - lead time label" },
  { key: "account.notifications.preferredTime", nl: "Voorkeurstijd", context: "AccountPage - preferred time label" },
  { key: "account.notifications.timezone", nl: "Tijdzone", context: "AccountPage - timezone label" },
  { key: "account.notifications.quietStart", nl: "Stilte start", context: "AccountPage - quiet hours start" },
  { key: "account.notifications.quietEnd", nl: "Stilte einde", context: "AccountPage - quiet hours end" },
  { key: "account.notifications.saveSettings", nl: "Instellingen opslaan", context: "AccountPage - save settings button" },
  { key: "account.notifications.enablePush", nl: "Push activeren", context: "AccountPage - enable push button" },
  { key: "account.notifications.disablePush", nl: "Push uitschakelen", context: "AccountPage - disable push button" },
  { key: "account.notifications.sendTest", nl: "Test notificatie", context: "AccountPage - send test button" },
  { key: "account.notifications.noConfig", nl: "Push serverconfiguratie ontbreekt (VAPID keys).", context: "AccountPage - no config" },
  { key: "account.notifications.saved", nl: "Notificatie-instellingen opgeslagen.", context: "AccountPage - settings saved" },
  { key: "account.notifications.serverNotConfigured", nl: "Push is niet geconfigureerd op de server.", context: "AccountPage - server not configured" },
  { key: "account.notifications.pushEnabled", nl: "Push notificaties zijn geactiveerd.", context: "AccountPage - push enabled" },
  { key: "account.notifications.pushDisabled", nl: "Push notificaties zijn uitgeschakeld.", context: "AccountPage - push disabled" },
  { key: "account.notifications.testSent", nl: "Test verstuurd: {{sent}} succesvol, {{failed}} mislukt.", context: "AccountPage - test sent result" },

  { key: "account.goals.title", nl: "Mijn Persoonlijke Doelen", context: "AccountPage - goals section" },
  { key: "account.goals.new", nl: "Nieuw Doel", context: "AccountPage - new goal button" },
  { key: "account.goals.loading", nl: "Laden...", context: "AccountPage - goals loading" },
  { key: "account.goals.none", nl: "Je hebt nog geen persoonlijke doelen.", context: "AccountPage - no goals" },
  { key: "account.goals.createFirst", nl: "Maak je eerste doel", context: "AccountPage - create first goal" },
  { key: "account.goals.maxReached", nl: "Maximum {{max}} doelen bereikt", context: "AccountPage - max goals reached" },

  { key: "account.password.title", nl: "Wachtwoord wijzigen", context: "AccountPage - password section" },
  { key: "account.password.new", nl: "Nieuw wachtwoord", context: "ChangePasswordForm - new password label" },
  { key: "account.password.confirm", nl: "Bevestig wachtwoord", context: "ChangePasswordForm - confirm label" },
  { key: "account.password.placeholder", nl: "Minimaal 8 tekens", context: "ChangePasswordForm - placeholder" },
  { key: "account.password.repeatPlaceholder", nl: "Herhaal je wachtwoord", context: "ChangePasswordForm - repeat placeholder" },
  { key: "account.password.change", nl: "Wachtwoord wijzigen", context: "ChangePasswordForm - submit button" },
  { key: "account.password.changing", nl: "Bezig...", context: "ChangePasswordForm - submitting state" },
  { key: "account.password.success", nl: "Wachtwoord succesvol gewijzigd", context: "ChangePasswordForm - success message" },
  { key: "account.password.notLoggedIn", nl: "Niet ingelogd", context: "ChangePasswordForm - not logged in" },

  { key: "account.about.title", nl: "Over deze app", context: "AccountPage - about section" },
  { key: "account.about.description", nl: "Prana Mental Fitness — jouw persoonlijke tool voor mentale fitheid op het werk.", context: "AccountPage - about description" },
  { key: "account.about.privacy", nl: "Privacybeleid", context: "AccountPage - privacy policy link" },
  { key: "account.about.terms", nl: "Algemene voorwaarden", context: "AccountPage - terms link" },
  { key: "account.about.version", nl: "Versie {{version}}", context: "AccountPage - version display" },

  // ============================================================
  // PERSONAL GOALS
  // ============================================================
  { key: "goals.section.title", nl: "Persoonlijke Doelen", context: "PersonalGoalsSection - section title" },
  { key: "goals.section.add", nl: "Toevoegen", context: "PersonalGoalsSection - add button" },
  { key: "goals.section.loading", nl: "Laden...", context: "PersonalGoalsSection - loading" },
  { key: "goals.section.none", nl: "Geen persoonlijke doelen. Voeg je eerste toe!", context: "PersonalGoalsSection - empty state" },
  { key: "goals.card.todayCount", nl: "{{count}}x vandaag", context: "PersonalGoalsSection - today count" },
  { key: "goals.card.notDoneToday", nl: "Nog niet gedaan vandaag", context: "PersonalGoalsSection - not done today" },
  { key: "goals.card.totalCount", nl: "{{count}} totaal", context: "PersonalGoalsSection - total count" },
  { key: "goals.card.check", nl: "Doel afvinken", context: "PersonalGoalsSection - check goal" },

  { key: "goals.dialog.title.create", nl: "Nieuw Persoonlijk Doel", context: "PersonalGoalDialog - create title" },
  { key: "goals.dialog.title.edit", nl: "Doel Bewerken", context: "PersonalGoalDialog - edit title" },
  { key: "goals.dialog.name.label", nl: "Naam *", context: "PersonalGoalDialog - name label" },
  { key: "goals.dialog.name.placeholder", nl: "bijv. Spreken tijdens vergadering", context: "PersonalGoalDialog - name placeholder" },
  { key: "goals.dialog.description.label", nl: "Beschrijving (optioneel)", context: "PersonalGoalDialog - description label" },
  { key: "goals.dialog.description.placeholder", nl: "Voeg een beschrijving toe...", context: "PersonalGoalDialog - description placeholder" },
  { key: "goals.dialog.save", nl: "Opslaan", context: "PersonalGoalDialog - save button" },
  { key: "goals.dialog.add", nl: "Toevoegen", context: "PersonalGoalDialog - add button" },
  { key: "goals.dialog.cancel", nl: "Annuleren", context: "PersonalGoalDialog - cancel button" },

  // ============================================================
  // VALIDATION - GOALS
  // ============================================================
  { key: "validation.goal.nameRequired", nl: "Doelnaam is verplicht", context: "Goal validation - name required" },
  { key: "validation.goal.nameMaxLength", nl: "Doelnaam mag maximaal 200 karakters zijn", context: "Goal validation - name max length" },
  { key: "validation.goal.descriptionMaxLength", nl: "Beschrijving mag maximaal 1000 karakters zijn", context: "Goal validation - description max length" },
  { key: "validation.goal.notLoggedIn", nl: "Je bent niet ingelogd", context: "Goal validation - not logged in" },

  // ============================================================
  // GOOD HABITS
  // ============================================================
  { key: "habits.section.title", nl: "Goede Gewoontes", context: "GoodHabitsSection - section title" },
  { key: "habits.section.loading", nl: "Laden...", context: "GoodHabitsSection - loading" },

  // ============================================================
  // REWARDS & GAMIFICATION
  // ============================================================
  { key: "rewards.scores.mentalFitness", nl: "Mental Fitness", context: "ScoreWidgets - mental fitness label" },
  { key: "rewards.scores.personalGoals", nl: "Pers. Doelen", context: "ScoreWidgets - personal goals label" },
  { key: "rewards.scores.habits", nl: "Gewoontes", context: "ScoreWidgets - habits label" },

  { key: "rewards.toast.level", nl: "Niveau {{level}}!", context: "RewardToast - level up" },
  { key: "rewards.toast.points", nl: "+{{points}} punten", context: "RewardToast - points earned" },
  { key: "rewards.toast.badge", nl: "{{badgeName}} verdiend!", context: "RewardToast - badge earned" },

  { key: "rewards.milestone.25", nl: "25% voltooid!", context: "Milestone - 25%" },
  { key: "rewards.milestone.50", nl: "Halverwege!", context: "Milestone - 50%" },
  { key: "rewards.milestone.75", nl: "75% voltooid!", context: "Milestone - 75%" },
  { key: "rewards.milestone.100", nl: "Programma afgerond!", context: "Milestone - 100%" },

  // Level titles
  { key: "rewards.level.1", nl: "Beginner", context: "Level 1 title" },
  { key: "rewards.level.2", nl: "Ontdekker", context: "Level 2 title" },
  { key: "rewards.level.3", nl: "Beoefenaar", context: "Level 3 title" },
  { key: "rewards.level.4", nl: "Doorzetter", context: "Level 4 title" },
  { key: "rewards.level.5", nl: "Expert", context: "Level 5 title" },
  { key: "rewards.level.6", nl: "Meester", context: "Level 6 title" },
  { key: "rewards.level.7", nl: "Kampioen", context: "Level 7 title" },
  { key: "rewards.level.8", nl: "Legende", context: "Level 8 title" },
  { key: "rewards.level.9", nl: "Goeroe", context: "Level 9 title" },
  { key: "rewards.level.10", nl: "Mentale Atleet", context: "Level 10 title" },

  // Badge names and descriptions
  { key: "badges.eersteSession.name", nl: "Eerste Sessie", context: "Badge name" },
  { key: "badges.eersteSession.description", nl: "Voltooi je eerste methode", context: "Badge description" },
  { key: "badges.vijfMethodes.name", nl: "Op Dreef", context: "Badge name" },
  { key: "badges.vijfMethodes.description", nl: "Voltooi 5 methodes", context: "Badge description" },
  { key: "badges.twintigMethodes.name", nl: "Doorgewinterd", context: "Badge name" },
  { key: "badges.twintigMethodes.description", nl: "Voltooi 20 methodes", context: "Badge description" },
  { key: "badges.eersteProgramma.name", nl: "Programma Afgerond", context: "Badge name" },
  { key: "badges.eersteProgramma.description", nl: "Rond je eerste programma af", context: "Badge description" },
  { key: "badges.kwartProgramma.name", nl: "Kwart Klaar", context: "Badge name" },
  { key: "badges.kwartProgramma.description", nl: "25% van een programma voltooid", context: "Badge description" },
  { key: "badges.halfProgramma.name", nl: "Halverwege", context: "Badge name" },
  { key: "badges.halfProgramma.description", nl: "50% van een programma voltooid", context: "Badge description" },
  { key: "badges.driekwartProgramma.name", nl: "Bijna Daar", context: "Badge name" },
  { key: "badges.driekwartProgramma.description", nl: "75% van een programma voltooid", context: "Badge description" },
  { key: "badges.weekStreak.name", nl: "Week Warrior", context: "Badge name" },
  { key: "badges.weekStreak.description", nl: "7 dagen op rij actief", context: "Badge description" },
  { key: "badges.tweeWekenStreak.name", nl: "Constante Kracht", context: "Badge name" },
  { key: "badges.tweeWekenStreak.description", nl: "14 dagen op rij actief", context: "Badge description" },
  { key: "badges.maandStreak.name", nl: "Maand Meester", context: "Badge name" },
  { key: "badges.maandStreak.description", nl: "30 dagen op rij actief", context: "Badge description" },
  { key: "badges.goedeStart.name", nl: "Goede Start", context: "Badge name" },
  { key: "badges.goedeStart.description", nl: "Voltooi je eerste gewoonte", context: "Badge description" },
  { key: "badges.dagelijkseHeld.name", nl: "Dagelijkse Held", context: "Badge name" },
  { key: "badges.dagelijkseHeld.description", nl: "Voltooi alle gewoontes op een dag", context: "Badge description" },
  { key: "badges.weekGewoontes.name", nl: "Gewoonte Guru", context: "Badge name" },
  { key: "badges.weekGewoontes.description", nl: "7 dagen alle gewoontes voltooid", context: "Badge description" },

  // ============================================================
  // WIZARDS - MANUAL
  // ============================================================
  { key: "wizard.step.basic.title", nl: "Basis", context: "Manual wizard - step title" },
  { key: "wizard.step.basic.description", nl: "Startdatum en duur", context: "Manual wizard - step description" },
  { key: "wizard.step.goals.title", nl: "Doelen", context: "Manual wizard - step title" },
  { key: "wizard.step.goals.description", nl: "Wat wil je bereiken?", context: "Manual wizard - step description" },
  { key: "wizard.step.mindset.title", nl: "Mindset", context: "Manual wizard - step title" },
  { key: "wizard.step.mindset.description", nl: "Kies overtuigingen", context: "Manual wizard - step description" },
  { key: "wizard.step.schedule.title", nl: "Schema", context: "Manual wizard - step title" },
  { key: "wizard.step.schedule.description", nl: "Wanneer train je?", context: "Manual wizard - step description" },
  { key: "wizard.step.methods.title", nl: "Methodes", context: "Manual wizard - step title" },
  { key: "wizard.step.methods.description", nl: "Jouw oefeningen", context: "Manual wizard - step description" },
  { key: "wizard.step.confirm.title", nl: "Bevestig", context: "Manual wizard - step title" },
  { key: "wizard.step.confirm.description", nl: "Overzicht", context: "Manual wizard - step description" },

  { key: "wizard.duration.1week", nl: "1 week", context: "Wizard - duration option" },
  { key: "wizard.duration.2weeks", nl: "2 weken", context: "Wizard - duration option" },
  { key: "wizard.duration.3weeks", nl: "3 weken", context: "Wizard - duration option" },
  { key: "wizard.duration.4weeks", nl: "4 weken", context: "Wizard - duration option" },
  { key: "wizard.duration.6weeks", nl: "6 weken", context: "Wizard - duration option" },
  { key: "wizard.duration.8weeks", nl: "8 weken", context: "Wizard - duration option" },

  { key: "wizard.error.sessionExpired", nl: "Sessie verlopen. Log opnieuw in.", context: "Wizard - session expired error" },
  { key: "wizard.error.createFailed", nl: "Kon programma niet aanmaken", context: "Wizard - create failed" },
  { key: "wizard.error.goalsSaveFailed", nl: "Kon doelstellingen niet opslaan", context: "Wizard - goals save failed" },
  { key: "wizard.error.scheduleSaveFailed", nl: "Kon schema niet opslaan", context: "Wizard - schedule save failed" },
  { key: "wizard.error.saveFailed", nl: "Kon programma niet opslaan", context: "Wizard - save failed" },

  // ============================================================
  // WIZARDS - AI
  // ============================================================
  { key: "wizard.ai.generating.title", nl: "Je programma wordt gegenereerd...", context: "AI wizard - generating title" },
  { key: "wizard.ai.generating.wait", nl: "Even geduld...", context: "AI wizard - generating wait" },
  { key: "wizard.ai.confirming.title", nl: "Je programma wordt opgeslagen...", context: "AI wizard - confirming title" },
  { key: "wizard.ai.error.title", nl: "Er ging iets mis", context: "AI wizard - error title" },
  { key: "wizard.ai.error.generateFailed", nl: "Kon programma niet genereren. Probeer het opnieuw.", context: "AI wizard - generate failed" },
  { key: "wizard.ai.error.saveFailed", nl: "Kon programma niet opslaan. Probeer het opnieuw.", context: "AI wizard - save failed" },
  { key: "wizard.ai.error.retry", nl: "Opnieuw proberen", context: "AI wizard - retry button" },

  // ============================================================
  // FEEDBACK MODAL
  // ============================================================
  { key: "feedback.title", nl: "Hoe was je sessie?", context: "FeedbackModal - title" },
  { key: "feedback.description", nl: "Je hebt \"{{methodName}}\" afgerond. Deel je ervaring (optioneel).", context: "FeedbackModal - description" },
  { key: "feedback.placeholder", nl: "Hoe voelde je je tijdens de oefening? Wat viel je op?", context: "FeedbackModal - textarea placeholder" },
  { key: "feedback.skip", nl: "Overslaan", context: "FeedbackModal - skip button" },
  { key: "feedback.save", nl: "Opslaan", context: "FeedbackModal - save button" },

  // ============================================================
  // PWA - INSTALL PROMPT
  // ============================================================
  { key: "install.tip", nl: "TIP", context: "InstallPrompt - tip label" },
  { key: "install.tip.description", nl: "Voeg eerst de app toe aan je startscherm, en log dan in. Je blijft dan ingelogd.", context: "InstallPrompt - tip description" },
  { key: "install.prompt.title", nl: "Installeer de app", context: "InstallPrompt - prompt title" },
  { key: "install.prompt.description", nl: "Voeg toe aan je startscherm voor snelle toegang", context: "InstallPrompt - prompt description" },
  { key: "install.button.install", nl: "Installeren", context: "InstallPrompt - install button" },
  { key: "install.button.installFull", nl: "Installeer op startscherm", context: "InstallPrompt - install full button" },
  { key: "install.button.skip", nl: "Overslaan", context: "InstallPrompt - skip button" },
  { key: "install.button.skipLogin", nl: "Overslaan en toch inloggen", context: "InstallPrompt - skip and login button" },
  { key: "install.button.later", nl: "Later", context: "InstallPrompt - later button" },
  { key: "install.button.understood", nl: "Begrepen", context: "InstallPrompt - understood button" },
  { key: "install.instructions.title", nl: "Stappen:", context: "InstallPrompt - instructions title" },
  { key: "install.instructions.ios.step1", nl: "Tik op", context: "InstallPrompt - iOS step 1" },
  { key: "install.instructions.ios.share", nl: "Delen", context: "InstallPrompt - iOS share label" },
  { key: "install.instructions.ios.step2", nl: "Scroll naar beneden", context: "InstallPrompt - iOS step 2" },
  { key: "install.instructions.ios.step3", nl: "Tik op", context: "InstallPrompt - iOS step 3" },
  { key: "install.instructions.ios.addToHome", nl: "\"Zet op beginscherm\"", context: "InstallPrompt - iOS add to home" },
  { key: "install.instructions.android.step1", nl: "Tik op het menu (\u22EE) rechtsboven", context: "InstallPrompt - Android step 1" },
  { key: "install.instructions.android.step2", nl: "Tik op", context: "InstallPrompt - Android step 2" },
  { key: "install.instructions.android.addToHome", nl: "\"Toevoegen aan startscherm\"", context: "InstallPrompt - Android add to home" },

  // ============================================================
  // PWA - UPDATE PROMPT
  // ============================================================
  { key: "update.available.title", nl: "Update beschikbaar", context: "PWAUpdatePrompt - title" },
  { key: "update.available.description", nl: "Nieuwe versie klaar om te installeren", context: "PWAUpdatePrompt - description" },
  { key: "update.button", nl: "Update", context: "PWAUpdatePrompt - update button" },
  { key: "update.close", nl: "Sluiten", context: "PWAUpdatePrompt - close button" },

  // ============================================================
  // NOTIFICATIONS / REMINDERS
  // ============================================================
  { key: "reminder.title", nl: "Herinnering in app actief", context: "InAppReminderBanner - title" },
  { key: "reminder.description.single", nl: "Je hebt vandaag {{count}} geplande activiteit. Push notificaties staan uit in je browser.", context: "InAppReminderBanner - single activity" },
  { key: "reminder.description.multiple", nl: "Je hebt vandaag {{count}} geplande activiteiten. Push notificaties staan uit in je browser.", context: "InAppReminderBanner - multiple activities" },
  { key: "reminder.settings", nl: "Push instellingen", context: "InAppReminderBanner - settings link" },
  { key: "reminder.close", nl: "Sluit herinnering", context: "InAppReminderBanner - close button" },

  // ============================================================
  // ERROR MESSAGES
  // ============================================================
  { key: "error.generic", nl: "Er is iets misgegaan", context: "Generic error message" },
  { key: "error.sessionExpired", nl: "Sessie verlopen. Log opnieuw in.", context: "Session expired error" },
  { key: "error.saveFailed", nl: "Opslaan mislukt", context: "Save failed error" },
  { key: "error.retryFailed", nl: "Er is een fout opgetreden. Probeer het opnieuw.", context: "Retry failed error" },
  { key: "error.unknown", nl: "Er is een fout opgetreden", context: "Unknown error" },
];

async function createTable() {
  console.log(`Creating Vertalingen table in base ${BASE_ID}...`);

  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Vertalingen',
      description: 'Translation keys and values for i18n. Synced to Postgres via worker.',
      fields: [
        {
          name: 'Key',
          type: 'singleLineText',
          description: 'Dot-notation translation key (e.g. auth.login.title)',
        },
        {
          name: 'nl',
          type: 'multilineText',
          description: 'Dutch translation (primary language)',
        },
        {
          name: 'fr',
          type: 'multilineText',
          description: 'French translation',
        },
        {
          name: 'en',
          type: 'multilineText',
          description: 'English translation',
        },
        {
          name: 'Context',
          type: 'singleLineText',
          description: 'Where this string is used (helps translators)',
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to create table: ${res.status} ${err}`);
    process.exit(1);
  }

  const table = await res.json();
  console.log(`Table created! ID: ${table.id}`);
  return table.id;
}

async function findTableByName(name) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to fetch tables metadata: ${res.status} ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  return data.tables?.find((t) => t.name === name) || null;
}

async function insertRecords(tableId) {
  console.log(`Inserting ${translations.length} translation records...`);

  // Airtable allows max 10 records per batch
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < translations.length; i += batchSize) {
    const batch = translations.slice(i, i + batchSize);
    const records = batch.map(t => ({
      fields: {
        Key: t.key,
        nl: t.nl,
        fr: '',
        en: '',
        Context: t.context || '',
      },
    }));

    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ['Key'] },
        records,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to insert batch starting at ${i}: ${res.status} ${err}`);
      process.exit(1);
    }

    inserted += batch.length;

    // Rate limit: Airtable allows 5 requests/sec
    if (i + batchSize < translations.length) {
      await new Promise(r => setTimeout(r, 220));
    }

    process.stdout.write(`\r  Inserted ${inserted}/${translations.length} records`);
  }

  console.log('\nDone!');
}

async function main() {
  const existing = await findTableByName('Vertalingen');
  const tableId = existing ? existing.id : await createTable();

  if (existing) {
    console.log(`Table already exists: ${existing.id}. Running upsert...`);
  }

  await insertRecords(tableId);

  console.log('\n=== IMPORTANT ===');
  console.log(`Add this to field-mappings.js:`);
  console.log(`  translations: process.env.AIRTABLE_TABLE_TRANSLATIONS || "${tableId}"`);
  console.log(`\nAdd to .env.example:`);
  console.log(`  AIRTABLE_TABLE_TRANSLATIONS=`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
