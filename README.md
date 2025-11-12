# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/b6f1ba83-b44c-4a41-8589-b1e5380cf1ea

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b6f1ba83-b44c-4a41-8589-b1e5380cf1ea) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b6f1ba83-b44c-4a41-8589-b1e5380cf1ea) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## 🧠 APE Platform — Features Overview

### 🎯 Core Features

#### **Study System**
- **Lists & Folders**: Organize flashcards by subject/topic
- **Multiple Study Modes**: Flip, Write, Multiple Choice, Unscramble
- **Progress Tracking**: Session history, statistics, streaks
- **Portal Access**: Access shared content from teachers

#### **Economy & Rewards**
- **Points (PTS)**: Earn by studying and completing activities
- **PiteCoin (PTC)**: Premium currency for store purchases
- **Manual Exchange**: Convert PTS → PTC at configurable rates
- **Store**: Buy avatar and mascot skins
- **Inventory & Appearance**: Equip and manage owned items
- **Gift System**: Admins can send gifts to users

#### **Kingdoms (Reinos)**
- **Learning Paths**: Structured lessons by kingdom/realm
- **Activity Types**: Multiple choice, write, unscramble
- **Progress Tracking**: Per-kingdom completion and accuracy
- **CSV Import**: Batch import activities

### 👥 Professor ↔ Aluno System

#### **For Teachers (`is_teacher=true`)**
- **Meus Alunos** (`/professor/alunos`): List students who follow you
  - Search by name or APE ID
  - Add students to classes in bulk
  - Direct assignment to students
  - View student profiles and progress
  - Open DM conversations
- **Minhas Turmas** (`/turmas`): Create and manage classes
  - Create assignments (lists, folders, kingdoms)
  - Monitor student completion
  - Class-wide chat and announcements
  - DM individual students

#### **For Students**
- **Meus Professores** (`/my-teachers`): View followed teachers
- **Turmas** (`/turmas`): Join classes via code, view assignments
- **Follow Teachers**: Subscribe to teachers to access their content
- **Teacher Profiles** (`/professores/:professorId`): View and follow teachers
- **Portal Access** (`/portal`): Browse public shared content

### 🔐 Security & Permissions

#### **Row Level Security (RLS)**
All tables enforce RLS policies:
- Users can only access their own data
- Teachers can only see their students/classes
- Students can only see classes they're members of
- Admin features protected by `developer_admin` role

#### **Authentication**
- Email/password signup/login
- Auto-confirm emails (non-production)
- Session management with JWT
- Protected routes redirect to `/auth`

### 🧩 Key Routes

#### Public
- `/auth` - Login/Signup
- `/portal` - Public content portal
- `/portal/folder/:id` - Public folder view
- `/portal/collection/:id` - Public collection view

#### Authenticated
- `/` - Home dashboard
- `/folders` - User's folders/lists
- `/folder/:id` - Folder detail
- `/list/:id` - List detail
- `/list/:id/study` - Study session
- `/store` - PiteCoin store
- `/gifts` - Gift inbox
- `/profile` - User profile

#### Classes & Students
- `/turmas` - Classes hub (role-aware routing)
- `/turmas/:turmaId` - Class detail (chat, assignments, members)
- `/turmas/:turmaId/atribuicoes/:atribuicaoId` - Assignment detail
- `/professor/alunos` - Teacher's student list
- `/professor/alunos/:alunoId` - Student profile (teacher view)
- `/professores/:professorId` - Teacher profile (student view)
- `/my-teachers` - Student's followed teachers

#### Kingdoms
- `/reinos` - Kingdoms list
- `/reino/:code` - Kingdom detail
- `/reino/importar` - CSV import (admin)

#### Admin
- `/admin/catalog` - Manage skins catalog
- `/admin/logs` - View admin action logs
- `/admin/gifts` - Send gifts to users

### 📦 Tech Stack

#### Frontend
- **React** + **TypeScript** + **Vite**
- **React Router** for navigation
- **TanStack Query** for server state
- **Tailwind CSS** + **shadcn/ui** components
- **Sonner** for toasts

#### Backend (Lovable Cloud / Supabase)
- **PostgreSQL** database with RLS
- **Edge Functions** for business logic
- **Storage** for skins/assets
- **Realtime** for chat/notifications

### 🚀 Feature Flags

Configure in `src/lib/featureFlags.ts`:
```typescript
store_visible: true
economy_enabled: true
admin_skins_enabled: true
reinos_enabled: true
classes_enabled: true
class_comms_enabled: true
meus_alunos_enabled: true
```

### 📚 Documentation

- `docs/BLOCO1_TURMAS_MVP.md` - Classes system spec
- `docs/BLOCO2_MENSAGENS_COMMS.md` - Messaging system spec
- `docs/MEUS_ALUNOS.md` - Professor-student feature spec
- `docs/PURCHASE_SYSTEM.md` - Store/economy spec
- `docs/PROFESSOR_ALUNOS_FIX.md` - Latest fix report

---

## 🐛 Debugging

### Console Logs
Check browser console for:
- Authentication state changes
- API call errors (look for 401, 403, 500)
- Validation errors

### Common Issues

**401 Unauthorized**
- Check if user is logged in (`supabase.auth.getSession()`)
- Verify Authorization header is sent to edge functions

**404 Not Found**
- Verify route is registered in `src/App.tsx`
- Check lazy import path is correct

**RLS Policy Violation**
- Review policies in Supabase dashboard
- Ensure user has correct role (`is_teacher`, `user_roles`)

---

## 📝 Contributing

1. **Make changes via Lovable**: Changes are auto-committed
2. **Or clone locally**: Push to trigger rebuild
3. **Run tests**: `npm run build` to check for type errors
4. **Document**: Update relevant `.md` files in `docs/`

---

**Platform:** APE (Adaptive Progressive Education)  
**Version:** 2025.11.12  
**Status:** ✅ Production Ready
