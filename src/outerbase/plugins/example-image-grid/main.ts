/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable quotes */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-classes-per-file */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { OuterbasePluginTableConfiguration_$PLUGIN_ID } from "./config.view"
import { OuterbasePluginTable_$PLUGIN_ID } from "./table.view"

window.customElements.define(
  "outerbase-plugin-table-$PLUGIN_ID",
  OuterbasePluginTable_$PLUGIN_ID
)
window.customElements.define(
  "outerbase-plugin-table-configuration-$PLUGIN_ID",
  OuterbasePluginTableConfiguration_$PLUGIN_ID
)

export {}
