# JATL - Just A Time Logger

Minimal time logging for small teams. Static site, no build step required.

## Features

- Log hours per client / project / phase
- Weekly overview per person
- Reports with filters (period, client, project, person, phase)
- CSV export
- Authentication (only invited users can access)

## Setup

### 1. Database

The app expects a backend matching the schema in `schema.sql`. The default is Supabase (free tier is sufficient), but you can use any PostgreSQL-compatible backend by replacing `data-service.js`.

**Supabase setup:**

- Create a free project on [supabase.com](https://supabase.com)
- Enable **Data API** and **Automatic RLS** during creation
- Go to SQL Editor, paste the contents of `schema.sql`, click Run
- Go to Settings > API and copy your **Project URL** and **anon public key**

### 2. Users

Supabase Auth manages user accounts. Self-registration is disabled by design.

- Go to Authentication > Sign In / Providers > disable **Allow new users to sign up**
- Go to Authentication > Users > **Create a new user** (email + temporary password)
- Share the credentials with your team member 
- A profile is automatically created on first login

### 3. App

- Fork or clone this repo
- Replace the placeholder URL and anon key in `data-service.js`
- Host the files wherever you like (e.g. GitHub Pages, Netlify, Cloudflare Pages, or just open locally in a browser)

### 4. Usage

- Open the URL in your browser and log in
- Add clients, projects and optionally phases via Manage
- Log hours via Register

## Files

- `index.html` - page structure
- `style.css` - styling
- `app.js` - UI logic
- `data-service.js` - data layer (replaceable)
- `schema.sql` - database schema

## Security

- Only invited users can log in (self-registration disabled)
- Row Level Security on all tables
- Everyone can read all entries (for reports), but can only create/edit/delete their own
- Clients, projects and phases are shared and editable by all authenticated users
- The anon key in the code is safe to publish (RLS enforces all access rules)

## Roadmap

- [ ] Password change for users
- [ ] PWA (installable on phone)
