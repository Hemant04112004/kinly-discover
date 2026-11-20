# Kinly

Kinly is a mobile-first discovery experience designed to help people find meaningful mutual connections. It combines profile discovery, private likes, swipe gestures, mutual matches, and a dedicated matches view in one friendly interface.

The name **Kinly** reflects the idea of finding people who feel like a natural connection. It has a warm, approachable sound while remaining short, memorable, and suitable for a modern social application.

The project is implemented as a standalone React and Express application with a SQLite database. It includes normal user journeys, account registration and login, profile editing, an admin dashboard, profile management, swipe tracking, match controls, and route-specific views for Home, Discover, Matches, Profile, Login, Register, and Admin.

## Features

### User experience

- Mobile-first responsive design
- Phone number and password login
- Registration with photo, age, city or GPS location, bio, and interests
- Live password-strength feedback
- Drag or button-based swipe interactions
- Like and pass actions
- Mutual-match detection
- Matches page containing only confirmed mutual matches
- Persistent swipes and matches across reloads
- Editable profile from the avatar dropdown
- Separate routes for Home, Discover, Matches, Profile, Login, and Register

### Admin experience

- Protected `/admin` dashboard
- Database totals for users, profiles, swipes, and matches
- Searchable user and profile tables
- Full user profile editing
- User photo management
- Individual swipe and match details
- Ability to unmark a specific match
- Ability to reset all swipes and matches for a user
- Add, edit, and delete discovery profiles
- Profile dropdown with access to Profile, Discover, and Log out

## Technology stack

- Frontend: React with Vite
- Backend: Node.js and Express
- Database: SQLite
- Authentication: Phone number and password with salted password hashing
- Profile data: Open-source-style DummyJSON sample data
- Profile images: DummyJSON images with application-level avatar fallbacks

SQLite was selected because it is file-based, requires no external database server or account, and is easy to run and review for this assignment. The database file is created automatically at `data/coy.sqlite`.

## Open-source profile data

Kinly uses 32 profiles from the [DummyJSON Users API](https://dummyjson.com/users) as open-source demo data.

The importer maps the source fields into the application's profile format:

| DummyJSON field | Kinly field |
|---|---|
| `firstName + lastName` | Name |
| `age` | Age |
| `image` | Profile photo |
| `address.city` | City |
| Generated template | Bio |
| Generated interests | Interests |

DummyJSON is useful for development because it provides ready-made names, ages, images, and locations. It is not a live Kinly user directory. The imported records become local SQLite records, so the website does not need to call DummyJSON while users browse it.

The current frontend is visual-rich and can display many users at once on the admin dashboard, profile cards, and match lists. For that reason, the app uses a SQL search API with SQLite indexes and a result limit instead of loading and processing every record in the browser. This is suitable for a realistic demo and keeps typing and search requests fast. If an implementation grows to thousands or millions of accounts, a hosted database and server-side pagination would be more appropriate.

## Requirements

- Node.js 22.5 or newer
- npm
- A modern browser

The application uses Node's built-in SQLite module, so no separate SQLite installation or database server is required.

## Installation

Clone or download this project, open a terminal in the project folder, and install dependencies:

```powershell
npm.cmd install
```

## Import demo profile data

To import 32 profiles from DummyJSON into SQLite:

```powershell
npm.cmd run seed:dummyjson
```

This creates or updates `data/coy.sqlite`. It also resets the demo swipe state and replaces the seeded profiles. It can be run again when a clean demo dataset is needed.

If the import is not run first, the backend creates a local fallback profile dataset automatically.

## Run the complete website

Start the Express API and Vite frontend:

```powershell
npm.cmd run dev
```

Open:

- User application: `http://localhost:5173`
- Direct user routes: `http://localhost:5173/discover`
- Registration: `http://localhost:5173/register`
- Login: `http://localhost:5173/login`

The API is available at:

- `http://localhost:3001`

When running the production build, the Express server can serve the application directly:

```powershell
npm.cmd run build
npm.cmd start
```

Then open `http://localhost:3001`.

## Demo accounts

The existing imported profile accounts use the generated password:

```text
Password: Coy@1234
```

Example first account:

```text
Phone: +919000000001
Password: Coy@1234
```

The demo account phone numbers are generated sequentially as `+919000000001`, `+919000000002`, and onward.

## Admin login

Open:

```text
http://localhost:3001/admin
```

Use:

```text
Phone: +918755436784
Password: Admin@04
```

The admin account has access to:

- Overview metrics
- User management
- Discovery profile management
- Full profile editing
- User swipe and match controls
- Individual match removal
- Complete swipe and match reset

The admin header uses the same Kinly profile dropdown pattern as the user interface.

## Main routes

| Route | Purpose |
|---|---|
| `/home` | User home view |
| `/discover` | Swipe discovery |
| `/matches` | Confirmed mutual matches |
| `/profile` | Logged-in user's profile |
| `/login` | Phone-and-password login |
| `/register` | New account registration |
| `/admin` | Protected database administration |

## Backend API

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`

### Discovery

- `GET /api/feed`
- `POST /api/swipe`
- `GET /api/matches`

### Profile

- `PUT /api/profile`

### Admin

- `GET /api/admin/overview`
- `GET /api/admin/users?q=<search>`
- `GET /api/admin/users/:id/details`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-swipes`
- `DELETE /api/admin/users/:id/swipes/:profileId`
- `GET /api/admin/profiles?q=<search>`
- `POST /api/admin/profiles`
- `PUT /api/admin/profiles/:id`
- `DELETE /api/admin/profiles/:id`

## Database

The SQLite database contains:

- `users` for registered and generated accounts
- `profiles` for discovery cards
- `swipes` for user likes and passes

Mutual matches are derived from the combination of a user's like record and the profile's `liked_by_demo` or matching relationship data. The backend does not expose undisclosed incoming likes.

## Security notes

- Passwords are stored as salted cryptographic hashes
- Password strength is checked during registration
- Admin endpoints require an admin session
- Profile updates require a valid session
- Users are prevented from editing another user's account through the self-profile API
- Primary admin account deletion is blocked

## Reset and rebuild

After changing data or frontend code:

```powershell
npm.cmd run seed:dummyjson
npm.cmd run build
npm.cmd start
```


