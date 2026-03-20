# Add TextShimmer Component

## Objective
Integrate the TextShimmer component into the frontend Next.js codebase to provide visual feedback during AI generation states, strictly adhering to the SpecFlow guidelines and codebase conventions.

## Key Files & Context
- frontend/package.json
- frontend/components/ui/text-shimmer.tsx
- frontend/app/decompose/page.tsx
- frontend/app/features/page.tsx
- frontend/app/problems/page.tsx
- frontend/app/tasks/page.tsx
- frontend/app/sessions/page.tsx

## Implementation Steps
1. Install framer-motion in the frontend directory.
2. Create frontend/components/ui/text-shimmer.tsx.
3. Update all loading and generating states in the mentioned pages.

## Verification & Testing
- Ensure the TextShimmer effect renders during the AI generation process.