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

import {
  Privileges,
  OuterbasePluginConfig_$PLUGIN_ID,
  StyleSheet
} from "./shared"

const templateTable = document.createElement("template")
templateTable.innerHTML = `
<style>
  #container {
      display: flex;
      height: 100%;
      overflow-y: scroll;
  }

  .grid-container {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      padding: 12px;
      height: calc(100% - 24px);
  }

  .grid-item {
      display: flex;
      flex-direction: column;
      background-color: transparent;
      border: 1px solid rgb(238, 238, 238);
      border-radius: 4px;
      box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.05);
      overflow: clip;
  }

  .img-wrapper {
      height: 0;
      overflow: hidden;
      padding-top: 100%;
      box-sizing: border-box;
      position: relative;
  }

  img {
      width: 100%;
      vertical-align: top;
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      object-fit: cover;
  }

  .contents {
      padding: 12px;
  }

  .title {
      font-weight: bold;
      font-size: 16px;
      line-height: 24px;
      font-family: "Inter", sans-serif;
      line-clamp: 2;
      margin-bottom: 8px;
  }

  .description {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 14px;
      line-height: 20px;
      font-family: "Inter", sans-serif;

      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;  
      overflow: hidden;
  }

  .subtitle {
      font-size: 12px;
      line-height: 16px;
      font-family: "Inter", sans-serif;
      color: gray;
      font-weight: 300;
      margin-top: 8px;
  }

  p {
      margin: 0;
  }
  
  @media (prefers-color-scheme: dark) {
      .grid-item {
          border: 1px solid rgb(52, 52, 56);
          color: white;
      }
  }
</style>

<div id="container">
  
</div>
`

export class OuterbasePluginTable_$PLUGIN_ID extends HTMLElement {
  static get observedAttributes() {
    return Privileges
  }

  config = new OuterbasePluginConfig_$PLUGIN_ID({})

  items = []

  constructor() {
    super()

    this.shadow = this.attachShadow({ mode: "open" })
    this.shadow.appendChild(templateTable.content.cloneNode(true))
    this.shadowRoot?.adoptedStyleSheets = [StyleSheet]
  }

  connectedCallback() {
    const encodedTableJSON = this.getAttribute("configuration")
    const decodedTableJSON = encodedTableJSON
      ?.replace(/&quot;/g, '"')
      ?.replace(/&#39;/g, "'")
    const configuration =
      typeof decodedTableJSON === "string" && decodedTableJSON !== "undefined"
        ? JSON.parse(decodedTableJSON)
        : null

    if (configuration) {
      this.config = new OuterbasePluginConfig_$PLUGIN_ID(configuration)
    }

    // Set the items property to the value of the `tableValue` attribute.
    if (this.getAttribute("tableValue")) {
      const encodedTableJSON = this.getAttribute("tableValue")
      const decodedTableJSON = encodedTableJSON
        ?.replace(/&quot;/g, '"')
        ?.replace(/&#39;/g, "'")
      this.items = JSON.parse(decodedTableJSON)
    }

    // Manually render dynamic content
    this.render()
  }

  render() {
    this.shadow.querySelector("#container").innerHTML = `
      <div class="grid-container">
          ${this.items
            .map(
              (item) => `
              <div class="grid-item">
                  ${
                    this.config.imageKey
                      ? `<div class="img-wrapper"><img src="${
                          item[this.config.imageKey]
                        }" width="100" height="100"></div>`
                      : ""
                  }

                  <div class="contents">
                      ${
                        this.config.titleKey
                          ? `<p class="title">${item[this.config.titleKey]}</p>`
                          : ""
                      }
                      ${
                        this.config.descriptionKey
                          ? `<p class="description">${
                              item[this.config.descriptionKey]
                            }</p>`
                          : ""
                      }
                      ${
                        this.config.subtitleKey
                          ? `<p class="subtitle">${
                              item[this.config.subtitleKey]
                            }</p>`
                          : ""
                      }
                  </div>
              </div>
          `
            )
            .join("")}
      </div>
      `
  }
}
