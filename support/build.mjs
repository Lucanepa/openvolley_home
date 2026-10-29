#!/usr/bin/env node
// Renders openvolley.app/support in DE (/support), EN, FR and IT from the
// help of the app, section by section: each section of the app's "?" help
// gets its video, its questions and an "Ask about this" button for the
// contact form. Then the downloads, "Which app for what" and the form, which
// posts to the backend's /api/contact (support.js).
//
//   node support/build.mjs <outdir>     (build.sh passes dist)
//
// Reads support/help.json (written by escoresheet/frontend/scripts/
// export-help.mjs in the openvolley repository) and
// support/videos/manifest.json (the recorded videos), and copies the videos
// (and the guide PDFs, when GUIDES lists any) into <outdir>. See
// support/README.md for updating them.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES as LEGAL_ROUTES, legalLinksHtml, slug } from '../legal/build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node support/build.mjs <outdir>');
  process.exit(2);
}

const SITE = 'https://openvolley.app';
const LANGS = ['de', 'en', 'fr', 'it'];
// German at the root like the legal pages. The app's "?" help links to
// /support#<id>; the root page sends such a link on to the reader's language.
export const ROUTES = { de: '/support', en: '/en/support', fr: '/fr/support', it: '/it/support' };
const VIDEO_URL = '/support/videos';
const GUIDE_URL = '/support/guides';
const CONTACT_API = 'https://backend.openvolley.app/api/contact';
const CONTACT_EMAIL = 'support@openvolley.app';
// The backend's limits (escoresheet/backend/lib/contact.js)
const MAX_FILES = 5;
const MAX_FILES_MB = 10;
const MAX_COMMENTS = 5000;
// Cloudflare Pages takes files up to 25 MiB; the videos are made to stay under 6 MB.
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const VIDEO_TARGET_BYTES = 6 * 1000 * 1000;

// The guide PDFs listed in the guides block and copied to /support/guides,
// e.g. { key: 'quick', src: 'Openvolley eScoresheet Quick guide.pdf',
// file: 'openvolley-quick-guide.pdf', docLang: 'en' }. None for now: the
// Quick guide (January 2026) shows a real referee's name on its screenshots
// and the old look, the roll-out deck is the plan of January. List a current
// guide with invented names only.
const GUIDES = [];

const DOWNLOADS = [
  { label: 'Windows', href: 'https://get.openvolley.app/#windows', icon: 'monitor' },
  { label: 'macOS', href: 'https://get.openvolley.app/#macos', icon: 'laptop' },
  { label: 'Linux', href: 'https://get.openvolley.app/#linux', icon: 'square-terminal' },
  { label: 'Android', href: 'https://get.openvolley.app/#android', icon: 'tablet-smartphone' },
];

// "Which app for what": the app, where it runs, and its help section
const APPS = [
  { key: 'scorer', host: 'app.openvolley.app', icon: 'notebook-pen', section: 'home' },
  { key: 'referee', host: 'referee.openvolley.app', icon: 'whistle', section: 'referee' },
  { key: 'bench', host: 'bench.openvolley.app', icon: 'users', section: 'bench' },
  { key: 'livescore', host: 'livescore.openvolley.app', icon: 'radio', section: 'livescore' },
  { key: 'roster', host: 'roster.openvolley.app', icon: 'file-user', section: 'setup' },
  { key: 'hall', host: 'get.openvolley.app', icon: 'server', section: 'connections' },
];

// The page's own words. The form's labels follow the app's Support & feedback
// dialog (supportFeedback.* in the app's locales). German says "du" like the
// app's help texts.
const UI = {
  de: {
    name: 'Deutsch',
    title: 'Hilfe und Support',
    description: 'Videos und Antworten zu jedem Bildschirm des OpenVolley eScoresheet, die Anleitungen und ein Formular für den Support.',
    eyebrow: 'Support',
    lead: 'Zu jedem Teil der App gibt es ein kurzes Video und die häufigen Fragen. Das «?» auf jedem Bildschirm der App zeigt dieselbe Hilfe.',
    skip: 'Zum Inhalt springen',
    language: 'Sprache',
    home: 'OpenVolley Startseite',
    legalNav: 'Rechtliches',
    free: 'freie Software unter der',
    source: 'Quellcode',
    search: 'Fragen durchsuchen',
    searchPlaceholder: 'Zum Beispiel: Libero, PIN, rückgängig',
    contents: 'Inhalt',
    contactSupport: 'Support kontaktieren',
    guidesButton: 'Anleitungen',
    video: 'Video: {section}',
    recorded: 'Aufgenommen mit OpenVolley {version}',
    subtitles: 'Untertitel',
    questions: 'Fragen und Antworten',
    inApp: 'In der App: das «?» auf',
    ask: 'Frage dazu stellen',
    guidesTitle: 'Anleitungen und Downloads',
    guidesLead: 'Die Apps zum Installieren und welche App auf welches Gerät gehört.',
    guides: {
      quick: { title: 'Kurzanleitung', desc: 'Das eScoresheet Schritt für Schritt, mit Bildschirmfotos einer früheren Version (Januar 2026).' },
      rollout: { title: 'Roll-out-Info', desc: 'Was das eScoresheet bietet und die nächsten Schritte der Einführung.' },
    },
    docLang: { en: 'Englisch', de: 'Deutsch' },
    downloadsTitle: 'Apps installieren',
    downloadsLead: 'Die Desktop-App für Windows, macOS und Linux und die Android-App. Alle Pakete und Signaturschlüssel stehen auf get.openvolley.app.',
    whichTitle: 'Welche App wofür',
    help: 'Hilfe',
    apps: {
      scorer: { title: 'eScoresheet (Schreiber)', desc: 'Am Schreibertisch: Spiel einrichten, Auslosung, jeder Ballwechsel, Unterschriften. Im Browser oder als Desktop- oder Android-App.' },
      referee: { title: 'Schiedsrichter-Tablet', desc: 'Für den 1. und 2. Schiedsrichter: Spielstand, Aufstellungen mit Rotation, Auszeiten, Wechsel und Sanktionen.' },
      bench: { title: 'Bank-Tablet', desc: 'Für die Teambank: das Spiel des eigenen Teams, live. Es zeigt nur an; erfasst wird beim Schreiber.' },
      livescore: { title: 'Livescore', desc: 'Für Zuschauer und grosse Bildschirme: Teams, Spielstand und Sätze. Ohne PIN.' },
      roster: { title: 'Kader hochladen', desc: 'Für Trainer: den Kader als PDF vor dem Spiel an den Schreiber senden.' },
      hall: { title: 'Desktop-App: Hallen-Server', desc: 'Auf dem Computer des Schreibers. Sie liefert die Schiedsrichter-, Bank- und Livescore-Seiten an die Tablets im Hallennetz, ganz ohne Internet.' },
    },
    contactEyebrow: 'Kontakt',
    contactTitle: 'Support kontaktieren',
    contactLead: 'Fragen, Probleme während eines Spiels, Ideen: Schreib uns. Die Antwort kommt per E-Mail. Oder direkt an {email}.',
    form: {
      type: 'Wobei können wir helfen?',
      selectType: 'Typ auswählen...',
      types: { support: 'Support', feedback: 'Feedback', request: 'Funktionsanfrage' },
      supportType: 'Welche Art von Support brauchst du?',
      supportTypes: { bug: 'Fehlerbericht', help: 'Hilfe / Frage' },
      area: 'Welchen Bereich betrifft es?',
      selectArea: 'Bereich auswählen...',
      other: 'Etwas anderes',
      optional: 'optional',
      email: 'Deine E-Mail (für Rückfragen)',
      emailPlaceholder: 'name@beispiel.ch',
      message: 'Kommentare oder Beschreibung',
      messagePlaceholder: 'Beschreibe dein Problem, dein Feedback oder deine Anfrage möglichst genau...',
      messageHint: 'Bei einem Problem: was du gemacht hast, was passiert ist und auf welchem Gerät.',
      attachments: 'Anhänge',
      attach: 'Dateien anhängen',
      attachHint: 'Bis zu {max} Dateien, zusammen {mb} MB: Bilder, PDF, Text oder JSON. Bildschirmfotos und Backup-Dateien helfen.',
      honeypot: 'Website (leer lassen)',
      consent: 'Deine Nachricht und deine E-Mail-Adresse gehen an {email} und dienen nur dazu, dir zu antworten. Mehr dazu in der {privacy}.',
      privacy: 'Datenschutzerklärung',
      send: 'Senden',
      noscript: 'Das Formular braucht JavaScript. Schreib sonst direkt an {email}.',
    },
    js: {
      found: ['1 Frage gefunden', '{n} Fragen gefunden'],
      none: 'Keine Frage passt.',
      noneLink: 'Frag uns direkt',
      sending: 'Wird gesendet...',
      remove: '{name} entfernen',
      typeMissing: 'Wähle, wobei wir helfen können.',
      emailInvalid: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      messageMissing: 'Bitte beschreibe deine Frage oder dein Problem.',
      tooManyFiles: 'Du kannst bis zu {max} Dateien anhängen.',
      filesTooLarge: 'Die Anhänge sind zu gross. Zusammen dürfen sie höchstens {mb} MB haben.',
      fileType: '{name} kann nicht angehängt werden. Häng Bilder, PDF-, Text- oder JSON-Dateien an.',
      busy: 'Gerade kommen zu viele Nachrichten. Bitte versuch es in ein paar Minuten wieder.',
      sendError: 'Die Nachricht konnte nicht gesendet werden. Versuch es noch einmal oder schreib direkt eine E-Mail.',
      sendByEmail: 'Stattdessen per E-Mail senden',
      sent: 'Nachricht gesendet!',
      thankYou: {
        support: 'Vielen Dank für deine Meldung. Ich schaue sie mir so bald wie möglich an und melde mich, falls ich Fragen habe.',
        feedback: 'Vielen Dank für dein Feedback! Deine Rückmeldung hilft, dieses Tool zu verbessern.',
        request: 'Vielen Dank für deine Funktionsanfrage! Ich prüfe sie für kommende Updates.',
      },
      replyTo: 'Antworten gehen an {email}.',
      another: 'Weitere Nachricht senden',
    },
  },
  en: {
    name: 'English',
    title: 'Help and support',
    description: 'Videos and answers for every screen of the OpenVolley eScoresheet, the guides, and a form to contact support.',
    eyebrow: 'Support',
    lead: 'Each part of the app has a short video and its questions. The “?” on each screen of the app shows the same help.',
    skip: 'Skip to content',
    language: 'Language',
    home: 'OpenVolley home',
    legalNav: 'Legal',
    free: 'free software under the',
    source: 'Source code',
    search: 'Search the questions',
    searchPlaceholder: 'For example: libero, PIN, undo',
    contents: 'Contents',
    contactSupport: 'Contact support',
    guidesButton: 'Guides',
    video: 'Video: {section}',
    recorded: 'Recorded with OpenVolley {version}',
    subtitles: 'Subtitles',
    questions: 'Questions and answers',
    inApp: 'In the app: the “?” on',
    ask: 'Ask about this',
    guidesTitle: 'Guides and downloads',
    guidesLead: 'The apps to install, and which app goes on which device.',
    guides: {
      quick: { title: 'Quick guide', desc: 'The eScoresheet step by step, with screenshots of an earlier version (January 2026).' },
      rollout: { title: 'Roll-out info', desc: 'What the eScoresheet offers and the next steps of the roll-out.' },
    },
    docLang: { en: 'English', de: 'German' },
    downloadsTitle: 'Install the apps',
    downloadsLead: 'The desktop app for Windows, macOS and Linux, and the Android app. All packages and signing keys are on get.openvolley.app.',
    whichTitle: 'Which app for what',
    help: 'Help',
    apps: {
      scorer: { title: 'eScoresheet (scorer)', desc: 'At the scorer’s table: match setup, coin toss, every rally, signatures. In the browser, or as the desktop or Android app.' },
      referee: { title: 'Referee tablet', desc: 'For the 1st and 2nd referee: the score, the line-ups with the rotation, time-outs, substitutions and sanctions.' },
      bench: { title: 'Bench tablet', desc: 'For the team bench: your team’s match, live. It only shows the match; the scorer records it.' },
      livescore: { title: 'Livescore', desc: 'For fans and big screens: the teams, the score and the sets. No PIN needed.' },
      roster: { title: 'Roster upload', desc: 'For coaches: send the roster PDF to the scorer before the match.' },
      hall: { title: 'Desktop app: hall server', desc: 'On the scorer’s computer. It serves the referee, bench and livescore pages to the tablets on the hall network, with no internet needed.' },
    },
    contactEyebrow: 'Contact',
    contactTitle: 'Contact support',
    contactLead: 'Questions, problems during a match, ideas: write to us. The answer comes by email. Or write directly to {email}.',
    form: {
      type: 'What can we help you with?',
      selectType: 'Select type...',
      types: { support: 'Support', feedback: 'Feedback', request: 'Feature request' },
      supportType: 'What type of support do you need?',
      supportTypes: { bug: 'Bug report', help: 'Help / question' },
      area: 'Which area is this about?',
      selectArea: 'Select area...',
      other: 'Something else',
      optional: 'optional',
      email: 'Your email (for follow-up)',
      emailPlaceholder: 'your@email.com',
      message: 'Comments or description',
      messagePlaceholder: 'Please describe your issue, feedback, or request in detail...',
      messageHint: 'For a problem: what you did, what happened, and on which device.',
      attachments: 'Attachments',
      attach: 'Attach files',
      attachHint: 'Up to {max} files, {mb} MB in total: images, PDF, text or JSON. Screenshots and backup files help.',
      honeypot: 'Website (leave empty)',
      consent: 'Your message and your email address go to {email} and are used only to answer you. More in the {privacy}.',
      privacy: 'privacy policy',
      send: 'Send',
      noscript: 'The form needs JavaScript. Otherwise, write directly to {email}.',
    },
    js: {
      found: ['1 question found', '{n} questions found'],
      none: 'No question matches.',
      noneLink: 'Ask us directly',
      sending: 'Sending...',
      remove: 'Remove {name}',
      typeMissing: 'Choose what we can help you with.',
      emailInvalid: 'Please enter a valid email address.',
      messageMissing: 'Please describe your question or problem.',
      tooManyFiles: 'You can attach up to {max} files.',
      filesTooLarge: 'The attachments are too large. Together they may have {mb} MB at most.',
      fileType: '{name} cannot be attached. Attach images, PDF, text or JSON files.',
      busy: 'Too many messages right now. Please try again in a few minutes.',
      sendError: 'Failed to send message. Please try again or email directly.',
      sendByEmail: 'Send by email instead',
      sent: 'Message sent!',
      thankYou: {
        support: 'Thank you for your report. I’ll have a look as soon as possible and will contact you if I have questions.',
        feedback: 'Thank you for your feedback! Your input helps make this tool better.',
        request: 'Thank you for your feature request! I’ll consider it for future updates.',
      },
      replyTo: 'Replies go to {email}.',
      another: 'Send another message',
    },
  },
  fr: {
    name: 'Français',
    title: 'Aide et support',
    description: 'Vidéos et réponses pour chaque écran de l’eScoresheet OpenVolley, les guides et un formulaire pour contacter le support.',
    eyebrow: 'Support',
    lead: 'Chaque partie de l’application a une courte vidéo et ses questions. Le « ? » de chaque écran de l’application affiche la même aide.',
    skip: 'Aller au contenu',
    language: 'Langue',
    home: 'Accueil OpenVolley',
    legalNav: 'Informations légales',
    free: 'logiciel libre sous la',
    source: 'Code source',
    search: 'Chercher dans les questions',
    searchPlaceholder: 'Par exemple : libéro, PIN, annuler',
    contents: 'Sommaire',
    contactSupport: 'Contacter le support',
    guidesButton: 'Guides',
    video: 'Vidéo : {section}',
    recorded: 'Enregistrée avec OpenVolley {version}',
    subtitles: 'Sous-titres',
    questions: 'Questions et réponses',
    inApp: 'Dans l’application : le « ? » sur',
    ask: 'Poser une question',
    guidesTitle: 'Guides et téléchargements',
    guidesLead: 'Les applications à installer et quelle application va sur quel appareil.',
    guides: {
      quick: { title: 'Guide rapide', desc: 'L’eScoresheet pas à pas, avec des captures d’une version antérieure (janvier 2026).' },
      rollout: { title: 'Infos sur le déploiement', desc: 'Ce que propose l’eScoresheet et les prochaines étapes du déploiement.' },
    },
    docLang: { en: 'anglais', de: 'allemand' },
    downloadsTitle: 'Installer les applications',
    downloadsLead: 'L’application de bureau pour Windows, macOS et Linux, et l’application Android. Tous les paquets et les clés de signature sont sur get.openvolley.app.',
    whichTitle: 'Quelle application pour quoi',
    help: 'Aide',
    apps: {
      scorer: { title: 'eScoresheet (marqueur)', desc: 'À la table de marque : préparer le match, tirage au sort, chaque échange, signatures. Dans le navigateur, ou avec l’application de bureau ou Android.' },
      referee: { title: 'Tablette arbitre', desc: 'Pour le 1er et le 2e arbitre : le score, les compositions avec la rotation, les temps morts, les remplacements et les sanctions.' },
      bench: { title: 'Tablette du banc', desc: 'Pour le banc de l’équipe : le match de votre équipe, en direct. Elle affiche seulement ; le marqueur enregistre.' },
      livescore: { title: 'Livescore', desc: 'Pour le public et les grands écrans : les équipes, le score et les sets. Sans PIN.' },
      roster: { title: 'Envoi de l’effectif', desc: 'Pour les entraîneurs : envoyer l’effectif en PDF au marqueur avant le match.' },
      hall: { title: 'Application de bureau : serveur de salle', desc: 'Sur l’ordinateur du marqueur. Elle fournit les pages arbitre, banc et livescore aux tablettes du réseau de la salle, sans internet.' },
    },
    contactEyebrow: 'Contact',
    contactTitle: 'Contacter le support',
    contactLead: 'Questions, problèmes pendant un match, idées : écrivez-nous. La réponse arrive par e-mail. Ou directement à {email}.',
    form: {
      type: 'Comment pouvons-nous vous aider ?',
      selectType: 'Type de demande...',
      types: { support: 'Support technique', feedback: 'Commentaire / avis', request: 'Suggestion de fonctionnalité' },
      supportType: 'Type de support ?',
      supportTypes: { bug: 'Signaler un problème', help: 'Aide / question' },
      area: 'Quel domaine est concerné ?',
      selectArea: 'Choisir le domaine...',
      other: 'Autre chose',
      optional: 'optionnel',
      email: 'Votre e-mail (pour la réponse)',
      emailPlaceholder: 'exemple@mail.com',
      message: 'Description',
      messagePlaceholder: 'Détaillez votre demande ici...',
      messageHint: 'Pour un problème : ce que vous avez fait, ce qui s’est passé et sur quel appareil.',
      attachments: 'Pièces jointes',
      attach: 'Joindre des fichiers',
      attachHint: 'Jusqu’à {max} fichiers, {mb} Mo au total : images, PDF, texte ou JSON. Les captures d’écran et les fichiers de sauvegarde aident.',
      honeypot: 'Site web (laisser vide)',
      consent: 'Votre message et votre adresse e-mail vont à {email} et servent uniquement à vous répondre. Plus d’informations dans la {privacy}.',
      privacy: 'déclaration de protection des données',
      send: 'Envoyer',
      noscript: 'Le formulaire a besoin de JavaScript. Sinon, écrivez directement à {email}.',
    },
    js: {
      found: ['1 question trouvée', '{n} questions trouvées'],
      none: 'Aucune question ne correspond.',
      noneLink: 'Demandez-nous directement',
      sending: 'Envoi...',
      remove: 'Retirer {name}',
      typeMissing: 'Choisissez le type de demande.',
      emailInvalid: 'Veuillez saisir une adresse e-mail valide.',
      messageMissing: 'Veuillez décrire votre question ou votre problème.',
      tooManyFiles: 'Vous pouvez joindre jusqu’à {max} fichiers.',
      filesTooLarge: 'Les pièces jointes sont trop lourdes. Ensemble, elles peuvent faire {mb} Mo au plus.',
      fileType: '{name} ne peut pas être joint. Joignez des images, des PDF, des fichiers texte ou JSON.',
      busy: 'Trop de messages en ce moment. Réessayez dans quelques minutes.',
      sendError: 'Erreur lors de l’envoi. Réessayez ou écrivez directement par e-mail.',
      sendByEmail: 'Envoyer plutôt par e-mail',
      sent: 'Message envoyé !',
      thankYou: {
        support: 'Merci. Nous traiterons votre ticket dans les plus brefs délais.',
        feedback: 'Merci pour votre retour ! Cela nous aide à améliorer l’outil.',
        request: 'Suggestion reçue ! Nous l’étudierons pour les prochaines versions.',
      },
      replyTo: 'Les réponses arrivent à {email}.',
      another: 'Envoyer un autre message',
    },
  },
  it: {
    name: 'Italiano',
    title: 'Aiuto e supporto',
    description: 'Video e risposte per ogni schermata dell’eScoresheet OpenVolley, le guide e un modulo per contattare il supporto.',
    eyebrow: 'Supporto',
    lead: 'Ogni parte dell’app ha un breve video e le sue domande. Il «?» su ogni schermata dell’app mostra lo stesso aiuto.',
    skip: 'Vai al contenuto',
    language: 'Lingua',
    home: 'Pagina iniziale OpenVolley',
    legalNav: 'Note legali',
    free: 'software libero sotto la',
    source: 'Codice sorgente',
    search: 'Cerca nelle domande',
    searchPlaceholder: 'Per esempio: libero, PIN, annulla',
    contents: 'Indice',
    contactSupport: 'Contatta il supporto',
    guidesButton: 'Guide',
    video: 'Video: {section}',
    recorded: 'Registrato con OpenVolley {version}',
    subtitles: 'Sottotitoli',
    questions: 'Domande e risposte',
    inApp: 'Nell’app: il «?» su',
    ask: 'Fai una domanda',
    guidesTitle: 'Guide e download',
    guidesLead: 'Le app da installare e quale app va su quale dispositivo.',
    guides: {
      quick: { title: 'Guida rapida', desc: 'L’eScoresheet passo per passo, con schermate di una versione precedente (gennaio 2026).' },
      rollout: { title: 'Info sull’introduzione', desc: 'Cosa offre l’eScoresheet e i prossimi passi dell’introduzione.' },
    },
    docLang: { en: 'inglese', de: 'tedesco' },
    downloadsTitle: 'Installare le app',
    downloadsLead: 'L’app desktop per Windows, macOS e Linux, e l’app Android. Tutti i pacchetti e le chiavi di firma sono su get.openvolley.app.',
    whichTitle: 'Quale app per cosa',
    help: 'Aiuto',
    apps: {
      scorer: { title: 'eScoresheet (segnapunti)', desc: 'Al tavolo del segnapunti: preparare la partita, sorteggio, ogni scambio, firme. Nel browser, o come app desktop o Android.' },
      referee: { title: 'Tablet arbitro', desc: 'Per il 1° e il 2° arbitro: il punteggio, le formazioni con la rotazione, i timeout, le sostituzioni e le sanzioni.' },
      bench: { title: 'Tablet panchina', desc: 'Per la panchina: la partita della tua squadra, in diretta. Mostra soltanto; registra il segnapunti.' },
      livescore: { title: 'Livescore', desc: 'Per il pubblico e i grandi schermi: le squadre, il punteggio e i set. Senza PIN.' },
      roster: { title: 'Caricare il roster', desc: 'Per gli allenatori: inviare il roster in PDF al segnapunti prima della partita.' },
      hall: { title: 'App desktop: server della palestra', desc: 'Sul computer del segnapunti. Fornisce le pagine arbitro, panchina e livescore ai tablet sulla rete della palestra, senza internet.' },
    },
    contactEyebrow: 'Contatto',
    contactTitle: 'Contatta il supporto',
    contactLead: 'Domande, problemi durante una partita, idee: scrivici. La risposta arriva per email. Oppure scrivi direttamente a {email}.',
    form: {
      type: 'Come possiamo aiutarti?',
      selectType: 'Seleziona tipo...',
      types: { support: 'Supporto', feedback: 'Feedback', request: 'Richiesta funzionalità' },
      supportType: 'Di che tipo di supporto hai bisogno?',
      supportTypes: { bug: 'Segnalazione bug', help: 'Aiuto / domanda' },
      area: 'Quale area riguarda?',
      selectArea: 'Seleziona area...',
      other: 'Altro',
      optional: 'opzionale',
      email: 'La tua email (per risponderti)',
      emailPlaceholder: 'tua@email.com',
      message: 'Commenti o descrizione',
      messagePlaceholder: 'Descrivi il tuo problema, feedback o richiesta in dettaglio...',
      messageHint: 'Per un problema: cosa hai fatto, cosa è successo e su quale dispositivo.',
      attachments: 'Allegati',
      attach: 'Allega file',
      attachHint: 'Fino a {max} file, {mb} MB in totale: immagini, PDF, testo o JSON. Screenshot e file di backup aiutano.',
      honeypot: 'Sito web (lascia vuoto)',
      consent: 'Il tuo messaggio e il tuo indirizzo email vanno a {email} e servono solo per risponderti. Maggiori informazioni nell’{privacy}.',
      privacy: 'informativa sulla protezione dei dati',
      send: 'Invia',
      noscript: 'Il modulo ha bisogno di JavaScript. Altrimenti scrivi direttamente a {email}.',
    },
    js: {
      found: ['1 domanda trovata', '{n} domande trovate'],
      none: 'Nessuna domanda corrisponde.',
      noneLink: 'Chiedi direttamente a noi',
      sending: 'Invio in corso...',
      remove: 'Rimuovi {name}',
      typeMissing: 'Scegli come possiamo aiutarti.',
      emailInvalid: 'Inserisci un indirizzo email valido.',
      messageMissing: 'Descrivi la tua domanda o il tuo problema.',
      tooManyFiles: 'Puoi allegare fino a {max} file.',
      filesTooLarge: 'Gli allegati sono troppo grandi. Insieme possono pesare al massimo {mb} MB.',
      fileType: '{name} non può essere allegato. Allega immagini, PDF, file di testo o JSON.',
      busy: 'Troppi messaggi in questo momento. Riprova tra qualche minuto.',
      sendError: 'Invio del messaggio fallito. Riprova o invia un’email direttamente.',
      sendByEmail: 'Invia invece via email',
      sent: 'Messaggio inviato!',
      thankYou: {
        support: 'Grazie per la segnalazione. La esaminerò il prima possibile e ti contatterò se avrò domande.',
        feedback: 'Grazie per il tuo feedback! Il tuo contributo aiuta a migliorare questo strumento.',
        request: 'Grazie per la tua richiesta di funzionalità! La considererò per i futuri aggiornamenti.',
      },
      replyTo: 'Le risposte arrivano a {email}.',
      another: 'Invia un altro messaggio',
    },
  },
};

// ---------- helpers ----------

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** French spacing, as on the legal pages: narrow no-break space before : ; ! ? and inside « ». */
function typo(text, lang) {
  return lang === 'fr' ? text.replace(/ ([:;!?»])/g, '\u202f$1').replace(/« /g, '«\u202f') : text;
}

/** Plain text to HTML in the page's language. */
const t = (text, lang) => esc(typo(text, lang));

/** Fills {name} slots; the values are HTML already. */
function fill(html, values) {
  return html.replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));
}

/** An FAQ answer: escaped, the openvolley.app hosts and addresses linked. */
function richText(text, lang) {
  return t(text, lang).replace(
    /\b([a-z0-9._-]+@)?((?:[a-z0-9-]+\.)*openvolley\.app)\b/gi,
    (all, user, host) => (user ? `<a href="mailto:${all}">${all}</a>` : `<a href="https://${host}">${host}</a>`),
  );
}

const ICONS = join(ROOT, 'node_modules', 'lucide-static', 'icons');

/** Inline Lucide icon, like the hand-copied ones in index.html. */
function icon(name, extra = '') {
  const file = join(ICONS, `${name}.svg`);
  if (!existsSync(file)) throw new Error(`lucide-static has no icon "${name}" - run 'npm install' first`);
  const inner = readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/ \/>/g, '/>');
  const cls = `icon${extra ? ` ${extra}` : ''} lucide-${name}`;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** Width and height of a baseline or progressive JPEG (the posters). */
function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

const duration = (sec) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function megabytes(bytes, lang) {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${lang === 'en' ? mb : mb.replace('.', ',')} ${lang === 'fr' ? 'Mo' : 'MB'}`;
}

/** The anchor of the support section ("## 13. …") of the privacy policy in a language. */
function privacySupportHref(lang) {
  const md = readFileSync(join(ROOT, 'legal', lang, 'privacy.md'), 'utf8');
  const m = md.match(/^## (13\. .+)$/m);
  return LEGAL_ROUTES[lang].privacy + (m ? `#${slug(m[1])}` : '');
}

// ---------- data ----------

function loadData() {
  const help = JSON.parse(readFileSync(join(HERE, 'help.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(HERE, 'videos', 'manifest.json'), 'utf8'));
  if (!Array.isArray(help.sections) || !help.sections.length) throw new Error('support/help.json: no sections');
  const videos = new Map(manifest.map((v) => [v.id, v]));
  for (const s of help.sections) {
    for (const lang of LANGS) {
      if (!s.title?.[lang]) throw new Error(`support/help.json: section ${s.id} has no ${lang} title`);
      for (const f of s.faq) {
        if (!f.question?.[lang] || !f.answer?.[lang]) throw new Error(`support/help.json: ${s.id}/${f.id} has no ${lang} text`);
      }
    }
    const v = videos.get(s.id);
    if (!v) {
      console.warn(`WARNING: no video for section "${s.id}" in support/videos/manifest.json`);
      continue;
    }
    const files = [v.file, v.poster, ...Object.values(v.tracks || {})];
    for (const f of files) {
      const p = join(HERE, 'videos', f);
      if (!existsSync(p)) throw new Error(`support/videos/${f} is missing`);
      const size = statSync(p).size;
      if (size > MAX_ASSET_BYTES) throw new Error(`support/videos/${f}: ${size} bytes, Cloudflare Pages takes at most 25 MiB`);
      if (f === v.file && size > VIDEO_TARGET_BYTES) console.warn(`WARNING: support/videos/${f} is over 6 MB`);
    }
    v.size = jpegSize(readFileSync(join(HERE, 'videos', v.poster))) || { width: 1280, height: 800 };
    v.files = files;
  }
  return { help, videos };
}

// ---------- page ----------

function videoHtml(section, v, lang, ui, first) {
  const base = `${VIDEO_URL}/`;
  // The page's language first and on by default; every track is labelled in its own language
  const tracks = [lang, ...LANGS.filter((l) => l !== lang)]
    .filter((l) => v.tracks?.[l])
    .map((l) => `<track kind="subtitles" srclang="${l}" label="${esc(UI[l].name)}" src="${base}${esc(v.tracks[l])}"${l === lang ? ' default' : ''}>`)
    .join('\n            ');
  // Posters load when the section comes near (support.js); the first one at once
  const poster = first ? `poster="${base}${esc(v.poster)}"` : `data-poster="${base}${esc(v.poster)}"`;
  const version = v.appVersion ? `<span>${t(fill(ui.recorded, { version: v.appVersion }), lang)}</span>` : '';
  return `<figure class="help-video">
          <video controls preload="none" playsinline width="${v.size.width}" height="${v.size.height}" ${poster} aria-label="${esc(fill(ui.video, { section: section.title[lang] }))}">
            <source src="${base}${esc(v.file)}" type="video/mp4">
            ${tracks}
          </video>
          <figcaption><span class="chip">${icon('clapperboard')}${duration(v.durationSec)}</span>${version}</figcaption>
        </figure>`;
}

function sectionHtml(section, v, lang, ui, first) {
  const title = section.title[lang];
  const faq = section.faq
    .map(
      (f) => `<details class="faq-item" id="q-${esc(section.id)}-${esc(f.id)}">
            <summary><span>${t(f.question[lang], lang)}</span>${icon('chevron-down', 'faq-chevron')}</summary>
            <p>${richText(f.answer[lang], lang)}</p>
          </details>`,
    )
    .join('\n          ');
  const screens = [...new Set((section.screens || []).map((s) => s.name?.[lang]).filter(Boolean))];
  const inApp = screens.length
    ? `\n        <p class="help-screens">${icon('circle-help')}<span>${t(ui.inApp, lang)} ${screens.map((n) => `<strong>${t(n, lang)}</strong>`).join(', ')}</span></p>`
    : '';
  return `<section class="card help-section" id="${esc(section.id)}" aria-labelledby="${esc(section.id)}-title" data-help-section>
        <div class="help-head">
          <h2 id="${esc(section.id)}-title">${t(title, lang)}</h2>
          <a class="btn btn-ghost btn-sm" href="#contact" data-area="${esc(section.id)}">${icon('message-circle-question-mark')}${t(ui.ask, lang)}</a>
        </div>
        ${v ? videoHtml(section, v, lang, ui, first) : ''}
        <h3 class="faq-title">${t(ui.questions, lang)}</h3>
        <div class="faq">
          ${faq}
        </div>${inApp}
      </section>`;
}

function guidesHtml(lang, ui) {
  const guideRows = GUIDES.map((g) => {
    const size = statSync(join(ROOT, g.src)).size;
    const meta = `PDF · ${ui.docLang[g.docLang]} · ${megabytes(size, lang)}`;
    return `<li>
              <a class="row" href="${GUIDE_URL}/${g.file}" hreflang="${g.docLang}" type="application/pdf">
                <span class="row-icon">${icon('file-text')}</span>
                <span class="row-body">
                  <span class="row-title">${t(ui.guides[g.key].title, lang)} <span class="row-host">${t(meta, lang)}</span></span>
                  <span class="row-desc">${t(ui.guides[g.key].desc, lang)}</span>
                </span>
                ${icon('download', 'row-go')}
              </a>
            </li>`;
  }).join('\n            ');
  const downloads = DOWNLOADS.map((d) => `<a class="btn btn-ghost btn-sm" href="${d.href}">${icon(d.icon)}${d.label}</a>`).join('\n            ');
  const apps = APPS.map((a) => {
    const app = ui.apps[a.key];
    return `<li class="app-row">
              <span class="row-icon">${icon(a.icon)}</span>
              <span class="row-body">
                <span class="row-title">${t(app.title, lang)}</span>
                <span class="row-desc">${t(app.desc, lang)}</span>
                <span class="app-links"><a href="https://${a.host}">${a.host}</a><a href="#${a.section}">${t(ui.help, lang)}</a></span>
              </span>
            </li>`;
  }).join('\n            ');
  return `<section class="section support-block" id="guides" aria-labelledby="guides-title">
        <div class="section-head">
          <p class="eyebrow">${t(ui.guidesButton, lang)}</p>
          <h2 id="guides-title">${t(ui.guidesTitle, lang)}</h2>
          <p class="section-lead">${t(ui.guidesLead, lang)}</p>
        </div>
        ${guideRows ? `<div class="card">
          <ul class="rows">
            ${guideRows}
          </ul>
        </div>` : ''}
        <div class="card downloads-card">
          <h3>${t(ui.downloadsTitle, lang)}</h3>
          <p>${t(ui.downloadsLead, lang).replace('get.openvolley.app', '<a href="https://get.openvolley.app">get.openvolley.app</a>')}</p>
          <div class="actions">
            ${downloads}
          </div>
        </div>
        <div class="card">
          <h3 class="card-title">${t(ui.whichTitle, lang)}</h3>
          <ul class="app-rows">
            ${apps}
          </ul>
        </div>
      </section>`;
}

function contactHtml(sections, lang, ui) {
  const f = ui.form;
  const optional = `<span class="optional">(${t(f.optional, lang)})</span>`;
  const mail = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
  const types = Object.entries(f.types).map(([v, label]) => `<option value="${v}">${t(label, lang)}</option>`).join('');
  const areas = sections.map((s) => `<option value="${esc(s.id)}">${t(s.title[lang], lang)}</option>`).join('') + `<option value="other">${t(f.other, lang)}</option>`;
  const supportTypes = Object.entries(f.supportTypes)
    .map(([v, label]) => `<label class="choice"><input type="radio" name="supportType" value="${v}"><span>${t(label, lang)}</span></label>`)
    .join('\n                ');
  const accept = 'image/*,.pdf,.txt,.log,.csv,.json,.ndjson';
  const consent = fill(t(f.consent, lang), { email: mail, privacy: `<a href="${privacySupportHref(lang)}">${t(f.privacy, lang)}</a>` });
  // No action and Send disabled: support.js enables Send and posts to config.api. Without
  // JavaScript nothing can be posted (the backend's JSON never shows); the noscript line
  // gives the address.
  return `<section class="section support-block" id="contact" aria-labelledby="contact-title">
        <div class="section-head">
          <p class="eyebrow">${t(ui.contactEyebrow, lang)}</p>
          <h2 id="contact-title">${t(ui.contactTitle, lang)}</h2>
          <p class="section-lead">${fill(t(ui.contactLead, lang), { email: mail })}</p>
        </div>
        <div class="card contact-card">
          <form id="contact-form" class="contact-form" method="post" enctype="multipart/form-data" novalidate>
            <input type="hidden" name="source" value="website">
            <input type="hidden" name="language" value="${lang}">
            <div class="field">
              <label for="cf-type">${t(f.type, lang)}</label>
              <select id="cf-type" name="contactType" required aria-describedby="cf-type-error">
                <option value="">${t(f.selectType, lang)}</option>${types}
              </select>
              <p class="field-error" id="cf-type-error" hidden></p>
            </div>
            <fieldset class="field" id="cf-support-type">
              <legend>${t(f.supportType, lang)} ${optional}</legend>
              <div class="choices">
                ${supportTypes}
              </div>
            </fieldset>
            <div class="field">
              <label for="cf-area">${t(f.area, lang)} ${optional}</label>
              <select id="cf-area" name="area">
                <option value="">${t(f.selectArea, lang)}</option>${areas}
              </select>
            </div>
            <div class="field">
              <label for="cf-email">${t(f.email, lang)}</label>
              <input id="cf-email" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="254" placeholder="${esc(f.emailPlaceholder)}" aria-describedby="cf-email-error">
              <p class="field-error" id="cf-email-error" hidden></p>
            </div>
            <div class="field">
              <label for="cf-message">${t(f.message, lang)}</label>
              <textarea id="cf-message" name="comments" required rows="6" maxlength="${MAX_COMMENTS}" placeholder="${esc(typo(f.messagePlaceholder, lang))}" aria-describedby="cf-message-hint cf-message-error"></textarea>
              <p class="field-hint" id="cf-message-hint">${t(f.messageHint, lang)}</p>
              <p class="field-error" id="cf-message-error" hidden></p>
            </div>
            <div class="field">
              <span class="label" id="cf-files-label">${t(f.attachments, lang)} ${optional}</span>
              <label class="btn btn-ghost btn-sm file-button">${icon('paperclip')}<span id="cf-files-button">${t(f.attach, lang)}</span><input id="cf-files" name="files" type="file" multiple accept="${accept}" aria-labelledby="cf-files-label cf-files-button" aria-describedby="cf-files-hint cf-files-error"></label>
              <ul class="file-list" id="cf-file-list" hidden></ul>
              <p class="field-hint" id="cf-files-hint">${t(fill(f.attachHint, { max: MAX_FILES, mb: MAX_FILES_MB }), lang)}</p>
              <p class="field-error" id="cf-files-error" hidden></p>
            </div>
            <div class="hp" aria-hidden="true">
              <label for="cf-website">${t(f.honeypot, lang)}</label>
              <input id="cf-website" name="website" type="text" tabindex="-1" autocomplete="off">
            </div>
            <p class="consent">${consent}</p>
            <div class="form-alert" id="cf-alert" role="alert" hidden></div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" id="cf-send" disabled>${icon('send')}<span>${t(f.send, lang)}</span></button>
            </div>
            <noscript><p class="field-hint">${fill(t(f.noscript, lang), { email: mail })}</p></noscript>
          </form>
          <div class="form-done" id="cf-done" tabindex="-1" hidden>
            ${icon('circle-check', 'done-icon')}
            <h3 id="cf-done-title"></h3>
            <p id="cf-done-text"></p>
            <p id="cf-done-reply" class="field-hint"></p>
            <button class="btn btn-ghost btn-sm" type="button" id="cf-again"></button>
          </div>
        </div>
      </section>`;
}

/** /support only: the app's links (/support#scoring) open in the reader's language. */
const LANGUAGE_PICK = `<script>
    // The app's "?" help links here (/support#<id>). Such a link, or ?lang=xx,
    // opens in the reader's language unless they chose one (support.js).
    (function () {
      var routes = ${JSON.stringify(Object.fromEntries(LANGS.filter((l) => l !== 'de').map((l) => [l, ROUTES[l]])))};
      var m = /[?&]lang=([a-z]{2})/.exec(location.search);
      var lang = m ? m[1] : '';
      if (!lang && location.hash) {
        try { lang = localStorage.getItem('ov-support-lang') || ''; } catch (e) {}
        if (!lang) lang = ((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
      }
      if (routes[lang]) location.replace(routes[lang] + location.hash);
    })();
  </script>
`;

function page(lang, data) {
  const ui = UI[lang];
  const { help, videos } = data;
  const url = SITE + ROUTES[lang];
  const alternates = LANGS.map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITE}${ROUTES[l]}">`).join('\n');
  const switcher = LANGS.map((l) => {
    const cur = l === lang ? ' aria-current="page"' : '';
    return `<a href="${ROUTES[l]}" lang="${l}" hreflang="${l}" title="${UI[l].name}"${cur}>${l.toUpperCase()}</a>`;
  }).join('');
  const toc = [
    ...help.sections.map((s) => `<li><a href="#${esc(s.id)}">${t(s.title[lang], lang)}</a></li>`),
    `<li class="toc-sep"><a href="#guides">${t(ui.guidesTitle, lang)}</a></li>`,
    `<li><a href="#contact">${t(ui.contactTitle, lang)}</a></li>`,
  ].join('\n          ');
  const sections = help.sections.map((s, i) => sectionHtml(s, videos.get(s.id), lang, ui, i === 0)).join('\n\n      ');
  // What support.js needs: its texts, the limits and where the form goes
  const config = {
    lang,
    api: CONTACT_API,
    email: CONTACT_EMAIL,
    maxFiles: MAX_FILES,
    maxFilesMb: MAX_FILES_MB,
    icons: { x: icon('x') },
    text: JSON.parse(JSON.stringify(ui.js), (k, v) => (typeof v === 'string' ? typo(v, lang) : v)),
  };

  return `<!DOCTYPE html>
<html lang="${lang}">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(ui.title)} – OpenVolley</title>
  <meta name="description" content="${esc(typo(ui.description, lang))}">
  <meta name="theme-color" content="#e2001a">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${url}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${SITE}${ROUTES.de}">
  ${lang === 'de' ? LANGUAGE_PICK : ''}
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OpenVolley">
  <meta property="og:title" content="${esc(ui.title)} – OpenVolley">
  <meta property="og:description" content="${esc(typo(ui.description, lang))}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/assets/brand/og-image.png">

  <link rel="preload" href="/assets/fonts/inter-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/landing.css">
  <link rel="stylesheet" href="/legal.css">
  <link rel="stylesheet" href="/support.css">
  <script src="/support.js" defer></script>
</head>

<body>
  <a class="skip-link" href="#main">${esc(ui.skip)}</a>

  <header class="topbar">
    <div class="wrap">
      <a class="brand" href="/" aria-label="${esc(ui.home)}">
        <img src="/assets/brand/openvolley-lockup.svg" alt="OpenVolley" width="149" height="32" draggable="false">
      </a>
      <nav class="lang-switch" aria-label="${esc(ui.language)}">${switcher}</nav>
    </div>
  </header>

  <main id="main" class="wrap support-main">
    <section class="card support-hero" aria-labelledby="support-title">
      <p class="eyebrow">${t(ui.eyebrow, lang)}</p>
      <h1 id="support-title">${t(ui.title, lang)}</h1>
      <p class="lead">${t(ui.lead, lang)}</p>
      <div class="search" role="search">
        <label class="sr-only" for="faq-search">${t(ui.search, lang)}</label>
        ${icon('search', 'search-icon')}
        <input id="faq-search" type="search" placeholder="${esc(typo(ui.searchPlaceholder, lang))}" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-controls="help-sections">
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="#contact">${icon('mail')}${t(ui.contactSupport, lang)}</a>
        <a class="btn btn-ghost" href="#guides">${icon('file-text')}${t(ui.guidesButton, lang)}</a>
      </div>
    </section>

    <div class="support-layout">
      <details class="card toc" open>
        <summary><span class="eyebrow">${esc(ui.contents)}</span>${icon('chevron-down', 'toc-chevron')}</summary>
        <ol>
          ${toc}
        </ol>
      </details>
      <script>if (!matchMedia('(min-width: 1024px)').matches) document.currentScript.previousElementSibling.open = false;</script>

      <div class="support-content">
      <p class="search-status" id="search-status" role="status"></p>

      <div class="help-sections" id="help-sections">
      ${sections}
      </div>

      ${guidesHtml(lang, ui)}

      ${contactHtml(help.sections, lang, ui)}
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="wrap">
      <nav class="legal-links" aria-label="${esc(ui.legalNav)}">${legalLinksHtml(lang, null)}</nav>
      <p>OpenVolley · ${esc(ui.free)} <a href="https://github.com/Lucanepa/openvolley/blob/main/LICENSE">GPL-3.0</a> · <a href="https://github.com/Lucanepa/openvolley">${esc(ui.source)}</a></p>
      <p>Icons: <a href="https://lucide.dev">Lucide</a> (ISC) · Font: <a href="https://rsms.me/inter/">Inter</a> (SIL OFL 1.1)</p>
    </div>
  </footer>

  <script type="application/json" id="support-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
</body>

</html>
`;
}

function build() {
  const data = loadData();

  for (const lang of LANGS) {
    const outFile = join(OUT, `${ROUTES[lang].slice(1)}.html`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, page(lang, data));
  }

  // The videos at /support/videos/<id>.mp4 (the app streams them from there too)
  const videoDir = join(OUT, VIDEO_URL.slice(1));
  mkdirSync(videoDir, { recursive: true });
  let videoFiles = 0;
  for (const v of data.videos.values()) {
    for (const f of v.files || []) {
      copyFileSync(join(HERE, 'videos', f), join(videoDir, f));
      videoFiles++;
    }
  }

  if (GUIDES.length) {
    const guideDir = join(OUT, GUIDE_URL.slice(1));
    mkdirSync(guideDir, { recursive: true });
    for (const g of GUIDES) copyFileSync(join(ROOT, g.src), join(guideDir, g.file));
  }

  const questions = data.help.sections.reduce((n, s) => n + s.faq.length, 0);
  console.log(`Support pages: ${LANGS.length} written (${data.help.sections.length} sections, ${questions} questions, ${videoFiles} video files, ${GUIDES.length} guides).`);
}

build();
