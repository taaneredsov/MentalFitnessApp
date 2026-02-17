export interface TourStep {
  targetSelector: string
  content: string
  optional?: boolean
}

export const HOMEPAGE_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="activity"]',
    content: 'Hier verschijnen je geplande activiteiten. Op trainingsdagen kun je op een oefening tikken om te beginnen.'
  },
  {
    targetSelector: '[data-tour="scores"]',
    content: 'Hier zie je je punten en streak. Blijf actief om je score te verhogen!'
  },
  {
    targetSelector: '[data-tour="progress"]',
    content: 'Volg hier je voortgang. Tik om je volledige programma te bekijken.'
  },
  {
    targetSelector: '[data-tour="goals"]',
    content: 'Stel persoonlijke doelen om extra gemotiveerd te blijven.',
    optional: true
  },
  {
    targetSelector: '[data-tour="habits"]',
    content: 'Bouw goede gewoontes op met dagelijkse check-ins.',
    optional: true
  },
  {
    targetSelector: '[data-tour="navigation"]',
    content: 'Navigeer hier naar je programma\'s, alle methodes, of je account-instellingen.'
  }
]
