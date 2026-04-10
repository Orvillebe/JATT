# JATL - Just A Time Logger

Minimale tijdregistratie voor kleine teams. Draait als statische site op GitHub Pages.

## Wat het doet

- Uren loggen per klant / project / fase
- Weekoverzicht per persoon
- Rapportage met filters (periode, klant, project, persoon, fase)
- CSV export

## Hoe te gebruiken

Open `index.html` in een browser, of deploy via GitHub Pages.

Data wordt lokaal opgeslagen in de browser (localStorage). Er is geen backend nodig om te testen.

## Bestanden

- `index.html` - pagina structuur
- `style.css` - styling
- `app.js` - UI logica
- `data-service.js` - datalaag (localStorage, later vervangbaar door bv. Supabase)

## Roadmap

- [ ] Supabase koppeling voor gedeelde data
- [ ] Authenticatie via Supabase Auth
- [ ] PWA (installeerbaar op telefoon)
