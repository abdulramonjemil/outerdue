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

import { PluginCSSStyleSheet } from "@/outerbase/system/plugin/base"

export const Privileges = ["tableValue", "configuration"]

export class OuterbasePluginConfig_$PLUGIN_ID {
  imageKey = undefined

  titleKey = undefined

  descriptionKey = undefined

  subtitleKey = undefined

  constructor(object) {
    this.imageKey = object?.imageKey
    this.titleKey = object?.titleKey
    this.descriptionKey = object?.descriptionKey
    this.subtitleKey = object?.subtitleKey
  }

  toJSON() {
    return {
      imageKey: this.imageKey,
      titleKey: this.titleKey,
      descriptionKey: this.descriptionKey,
      subtitleKey: this.subtitleKey
    }
  }
}

export const StyleSheet = new PluginCSSStyleSheet()
