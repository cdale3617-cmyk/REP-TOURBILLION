# Android build and installation handoff

## Current status

Target devices: Samsung S24 Ultra phone and Lenovo Idea Pro tablet.
This Expo project is not an APK. A browser
preview, Expo Go QR code, and JavaScript export are not standalone installers.
Replit does not currently provide a direct Android APK export or Google Play
publishing flow. No installable APK has been produced or signed here.

Native Android Health Connect and standard BLE heart-rate monitor integration
are implemented, with separate manual measured-reading entry. Physical-device
compatibility and permissions still need verification in the standalone APK.
These native connections do not work in Expo Go or the browser preview.
Do not represent this as a device-verified health/sensor release. Daily flag
positioning and mapped course update work are handled separately.

The user uses a Samsung Galaxy Watch and has selected Samsung Health as the
health-data source. The intended connection is Galaxy Watch → Samsung Health
on the S24 Ultra → Android Health Connect → DRC Golf Tourbillion, with explicit
read permissions. The exact watch model is not needed to select this route.
Do not require a separate Bluetooth sensor or direct pairing between DRC and
the watch. Samsung documents this route at
https://developer.samsung.com/health/health-connect-faq.html.
Read only supported, actually available measurements and retain their source
timestamps. Synchronization is not a live Bluetooth feed; do not promise that
all Samsung readings, including blood oxygen, will always be available. No
Samsung account password is needed in DRC.

## Build identity and privacy

- Android package: `com.drc.golftourbillion`.
- App version: `1.0.0`; Android version code: `1`.
- Keep the package ID and signing identity unchanged for future updates.
- No account, backend or secrets are needed for the implemented golf features.
- Android automatic backup is disabled; use explicit golf JSON and video exports.
- Camera and foreground location are requested when used.
- Gallery selection uses Android's system picker without broad library access.
- Microphone, background location and broad media/storage permissions are blocked.
- Overlay/draw-over-other-apps permission is also blocked.
- Weather and course-directory lookup need internet. Scores, bag, guides and
  bundled mapped geometry do not depend on the development server.

## Android builder handoff

These steps are for an Android developer/build machine, not phone settings.

1. Use a trusted copy of the full pnpm workspace, including this artifact and
   shared workspace packages. Do not export secrets, node_modules, `.env` files
   or signing keys. Install the Node/pnpm versions required by the workspace.
2. Install the workspace dependencies with `pnpm install --frozen-lockfile`.
3. Install Android Studio, the Android SDK and the JDK required by the generated
   Android Gradle configuration. Let that configuration determine SDK versions.
4. From this artifact directory, run `pnpm exec expo install --check`,
   `pnpm run test` and `pnpm run check:android --bundle`, then
   `pnpm exec expo prebuild --platform android --no-install`. Review the generated
   manifest: it must not grant microphone, background location or broad gallery
   permissions, and automatic backup must remain disabled.
5. Open the generated `android` project in Android Studio. Use
   **Build → Generate Signed App Bundle / APK → APK** for a standalone release
   APK. Manage the owner's signing key securely on that build machine; do not
   put it, its passwords or generated credentials into source control or chat.
6. Build the release variant with the JavaScript and assets bundled. A debug APK
   that needs Metro is not the requested standalone app. Confirm there is no
   dependency on a Replit development URL.

`check:android` validates the generated configuration and permission removals.
It also checks read-only health permissions, Bluetooth's never-for-location
declaration, and the Android health privacy-screen routing.
Adding `--bundle` also exports the production Android JavaScript and assets to
a temporary directory. Neither command produces an APK or replaces a native
Gradle build, signing or physical-device testing.

## Install and acceptance checks on the Samsung and Lenovo tablet

Only install the signed APK from the trusted builder. Transfer it to the phone,
open the file, and temporarily allow that source to install apps if Android asks.
Turn that permission off again after installation. Do not disable general device
security or install an APK from an unknown sender.

Before calling the app ready:

- Check the selected charcoal, white and silver palette across all screens and
  buttons. Keep the approved artwork unchanged.
- Check Anti-glare on Home and Round: white text/dark surfaces when on, the selected
  charcoal/silver palette when off, and the saved setting after a force-stop/reopen.
  Check outdoors.
- In Shot Pattern, record known lie/situation, grass/mat surface and relative wind
  tags. Confirm Caddie only compares at least five matching records per club,
  does not treat untagged legacy records as known matches, and blocks conflicting
  selections/question wording. Check rough/sand recovery references and putting
  guidance do not become normal-carry recommendations. Export/restore a golf
  backup and verify the optional tags survive.
- Current artwork is approved for the S24 test build: keep the emerald-and-gold
  image in `assets/images/icon.png`. It is used for the Android launcher icon,
  splash screen, home-screen header mark, and web favicon. The identical
  `icon_2.png` file is unused. Get user approval before changing this artwork.
- Complete the checks on both devices. On the Lenovo tablet, also verify all
  tabs, score entry, bag editing, guides, keyboard interactions and video controls
  remain usable at the tablet's actual screen size.
- Start it with Expo Go closed and the Replit preview/workflows unavailable.
- In airplane mode, edit the bag, save a round and practice note, force-stop the
  app and reopen it. Verify the data persists.
- Allow and deny camera/location permissions; verify usable recovery messages.
- On the S24 Ultra, allow, partially allow, deny and revoke Health Connect read
  access. Verify measured values, independent timestamps and data-source labels
  against Samsung Health. Missing data must stay missing, not show invented
  readings. On the tablet, verify an unavailable Health Connect provider is
  explained without preventing golf features from working.
- If using a separate standard BLE heart-rate monitor, test Nearby devices
  permission denial, Bluetooth off, scan, connect, receive, disconnect and
  unexpected loss. Background the app while permissions, scanning or connecting
  are pending; verify it does not later start collecting in the background.
  A Galaxy Watch does not require this separate BLE connection.
- Record a real camera clip, save it, force-stop/reopen, play it and export it.
- Select a clip and green photo through the system picker without allowing
  access to the entire photo library.
- Export golf JSON; cancel a restore, then confirm a restore. Verify scores are
  restored and videos remain available. Reject an invalid backup without changes.
- Save two manual health readings. Cancel one deletion, then confirm it; reopen
  the app and verify only the chosen entry was removed. Samsung Health and
  Health Connect records must be unchanged.
- Save a green photo with its note, force-stop/reopen and verify both are visible.
  Export the photo separately. Green-photo references survive JSON backups, but
  image files are separate; a missing image after transferring a backup must be
  explained while keeping its note available.
- Test precise and approximate location and internet-only weather/directory
  behavior. Mapped greens must not be presented as today's actual flags.
- Install a subsequent version with the same package and signing identity and
  verify it preserves local data. Export backups before testing updates.
- Resolve and test the pending health/sensor and course features before calling
  the full requested product finished.

Uninstalling or clearing app data deletes local golf data, videos and green photos. Export the
JSON backup and each video and green photo separately first. Each device has its own golf data
and video library; there is no automatic cross-device sync. To transfer golf
state, export JSON on one device and explicitly restore it on the other. That
restore replaces the receiving device's golf state. Transfer videos separately;
restoring JSON does not transfer them or connect the devices' health data.