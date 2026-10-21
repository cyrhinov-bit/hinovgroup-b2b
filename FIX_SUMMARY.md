# Fix Summary: Devis Module Service Selection

## Problem
When attempting to save a devis (quote), the error "Aucun service rattaché : sélectionnez un service (ou rattachez l'utilisateur à un service)" was displayed incorrectly for non-Director users.

## Root Cause
In `src/pages/QuoteCreation.tsx` line 104, the `serviceId` state was only initialized from `currentUser?.serviceId` for the "Responsable" role:

```javascript
// BEFORE (buggy)
const [serviceId, setServiceId] = useState(sourceQuote?.serviceId || serviceIdParam || (currentUser?.role === 'Responsable' ? (currentUser?.serviceId || '') : ''));
```

This meant:
- Only "Responsable" role users got their profile service pre-populated
- Other roles (Commercial, etc.) defaulted to empty string or URL param
- The validation `effectiveServiceId = currentUser?.serviceId || serviceId` would often be falsy
- Users with a service in their profile but who couldn't select it via UI (dropdown not shown for their role) would get the error

## Fix Applied
Changed line 104 to initialize `serviceId` from `currentUser?.serviceId` for ALL roles:

```javascript
// AFTER (fixed)
const [serviceId, setServiceId] = useState(sourceQuote?.serviceId || serviceIdParam || currentUser?.serviceId || '');
```

## Impact
- Users with a `service_id` in their profile will now have it pre-selected automatically
- The `availablePrestations` filtering works correctly for all roles
- Users without a service in their profile still get the intended error message
- The service dropdown remains role-gated (only Directors can change it)

## File Modified
- `C:\hinovapp\src\pages\QuoteCreation.tsx` line 104