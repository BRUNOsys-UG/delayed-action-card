# Delayed Action Card

The `Delayed Action Card` is a custom Home Assistant card that displays and manages delayed actions for various entities. It provides a user interface to view, create, and cancel delayed actions on supported entities.

[![hacs][hacs-image]][hacs-url]
[![GitHub Sponsors][gh-sponsors-image]][gh-sponsors-url]

https://github.com/BRUNOsys-UG/delayed-action-card/assets/1864448/29967331-d993-42a2-a391-d9b04fb37d50

### Requirements

- Ensure the "Delayed Action" custom integration is installed. You can find it at: https://github.com/BRUNOsys-UG/delayed_action

### Features

- Display current delayed actions for entities
- Create new delayed action with a specified delay or start time
- Cancel existing delayed action
- Support for various entity types including lights, switches, media players, covers, and more

### Installation:

### [HACS](hacs) (Home Assistant Community Store)

1. Go to HACS page on your Home Assistant instance
1. Add this repository (https://github.com/BRUNOsys-UG/delayed-action-card) via HACS Custom repositories [How to add Custom Repositories](https://hacs.xyz/docs/faq/custom_repositories/)
1. Select `Frontend`
1. Press add icon and search for `Delayed Action Card`
1. Select `Delayed Action Card` repo and install
1. Force refresh the Home Assistant page (<kbd>Ctrl</kbd> + <kbd>F5</kbd> / (<kbd>Shift</kbd> +) <kbd>⌘</kbd> + <kbd>R</kbd>)
1. Add delayed-action-card to your page

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BRUNOsys-UG&repository=delayed-action-card&category=plugin)

### Manual

1. Download the 'delayed-action-card.js' from the latest [release][latest-release] (with right click, save link as)
1. Place the downloaded file on your Home Assistant machine in the `config/www` folder (when there is no `www` folder in the folder where your `configuration.yaml` file is, create it and place the file there)
1. In Home Assistant go to `Configuration->Lovelace Dashboards->Resources` (When there is no `resources` tag on the `Lovelace Dashboard` page, enable advanced mode in your account settings, and retry this step)
1. Add a new resource
   1. Url = `/local/delayed-action-card.js`
   1. Resource type = `module`
1. Force refresh the Home Assistant page (<kbd>Ctrl</kbd> + <kbd>F5</kbd> / (<kbd>Shift</kbd> +) <kbd>⌘</kbd> + <kbd>R</kbd>)
1. Add delayed-action-card to your page

### Performance improvements

While `Delayed Action Card` can be installed as a [lovelace resource](https://www.home-assistant.io/lovelace/dashboards/#resources), some functionality will benefit greatly from it being installed as a [frontend module](https://www.home-assistant.io/integrations/frontend/#extra_module_url) instead.

To do that, add the following to your `configuration.yaml` file and restart Home Assistant and remove it from the Resources:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/delayed-action-card/delayed-action-card.js
```


### Usage

Click an indicator attached to a supported card or badge to schedule an action. Add a `custom:delayed-action-card` to the dashboard to list or cancel scheduled actions.

### Issues & Contributions:
If you encounter any issues or have suggestions for improvements, feel free to [open an issue](https://github.com/BRUNOsys-UG/delayed-action-card/issues) or submit a pull request.

## License

MIT © [Benedikt Hübschen][bhuebschen]

<!-- Badges -->

[hacs-url]: https://github.com/hacs/integration
[hacs-image]: https://img.shields.io/badge/hacs-custom-orange.svg?style=flat-square
[gh-sponsors-url]: https://github.com/sponsors/bhuebschen
[gh-sponsors-image]: https://img.shields.io/github/sponsors/bhuebschen?style=flat-square

<!-- References -->

[preview]: https://github.com/BRUNOsys-UG/delayed-action-card/assets/1864448/29967331-d993-42a2-a391-d9b04fb37d50
[home-assistant]: https://www.home-assistant.io/
[hacs]: https://hacs.xyz
[latest-release]: https://github.com/BRUNOsys-UG/delayed-action-card/releases/latest
[ha-scripts]: https://www.home-assistant.io/docs/scripts/
[edit-readme]: https://github.com/BRUNOsys-UG/delayed-action-card/edit/master/README.md

## Frontend architecture

The standalone JavaScript resource discovers supported cards and badges through open shadow roots and a public adapter registry. Indicators prefer local attachments that scroll with the card. Dedicated adapters handle media-control backgrounds and picture-card actions, including explicit entity and device targets. Picture backgrounds use aligned image layers; complex image compositions may not be reproduced exactly. The shared task store uses the existing delayed_action services and events.

The checked-in `delayed-action-card.js` is the source and deployable browser resource. No bundler or external selector library is needed. Run `node --check delayed-action-card.js` for a syntax check.

## Custom card libraries

Use the [public adapter API](docs/adapters.md) to add support for other card libraries without changing Delayed Action itself. Built-in adapters and generic discovery are registered through the same API.

## Automated releases

Push a version tag such as `v1.1.0-beta.1` to publish a release after a successful JavaScript syntax check. Alternatively run **Build & Release** with a version tag using workflow dispatch (the workflow must exist on the default branch for manual dispatch). Tags containing a hyphen become prereleases. Existing releases and tags pointing to another commit are rejected. Ordinary pushes and pull requests only validate and archive the checked-in JavaScript resource.
