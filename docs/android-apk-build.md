# DRC Golf Tempo — Android installer through GitHub Actions

Target repository: https://github.com/cdale3617-cmyk/REP-TOURBILLION

The workflow in `.github/workflows/android-apk.yml` installs the Android
toolchain on GitHub's runner, generates the ignored native Android project
with Expo prebuild, builds a release-variant APK, and verifies its signature,
package identifier, embedded JavaScript, ARM64 libraries and privacy permissions.

## Activating the workflow with the connected GitHub account

The connected GitHub authorization can write app source, but its declared scopes
do not include `workflow`. Reconnecting with the same scopes does not fix that.
The prepared workflow is also provided in the repository as `docs/android-apk.yml`.

The repository owner can activate it in GitHub's web editor:

1. Edit `docs/android-apk.yml`.
2. At the start of the filename field, type `../` to leave the `docs` directory,
   then change the filename to `.github/workflows/android-apk.yml`.
3. Commit this move to `main`. The file contents need no edits.

This activates the existing, manually triggered build configuration. It does not
start the build automatically. Once the workflow is present, the connected account
can request the build through GitHub Actions.

## Run and download

1. Push the app source and workflow to the repository's `main` branch.
2. Open **Actions → Build DRC Golf Android APK**.
3. Choose **Run workflow** only after the pre-build inclusion review is complete.
   Uploading source does not start a build automatically.
4. After a successful run, download **DRC-Golf-Tourbillion-Android** from
   the run's artifacts. Extract the ZIP to get `DRC-Golf-Tourbillion.apk`
   and its SHA-256 checksum.

## Scope and signing

The normal screen/button palette is the user-selected charcoal, white and silver.
The approved artwork remains unchanged. Anti-glare is still a separate saved
display option; switching it off restores the charcoal/silver palette.
The app's display name is DRC Golf Tempo. Existing package/storage identifiers and
the backup envelope remain unchanged; this is a cosmetic rename, not a data migration.

This is a **personal sideload/testing installer**, signed with Expo's generated
test keystore. It is not signed with a private production key and is not a
Google Play release. The release variant includes its JavaScript, so it does
not require Expo Go or a running Metro development server.

A successful workflow checks the APK, but does not prove it runs on a physical
Samsung. Camera, GPS, Health Connect and Bluetooth behavior still require
on-device verification. Do not uninstall an existing app to work around a
signature mismatch without first protecting any device-only saved data.

## Round-performance source

The source includes optional per-hole putts, penalty strokes, fairways and
greens in regulation, plus corrections on saved scorecards. Missing statistics
remain unknown; penalties are already included in the total score.

Round Performance Coach is available in Lab and from Round. It shows recorded
coverage, compares cards with matching courses, holes and pars, and suggests
practice from the recorded sample. It does not provide precise strokes gained
or adjust for changing tees and conditions.

These features have browser and automated-test coverage. This does not replace
testing an installed APK on the Samsung.
