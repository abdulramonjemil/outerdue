import { defineCommandInterface } from "@/outerbase/system/command"

export const SampleCommandInterface = defineCommandInterface({
  origin: "https://tired-violet.cmd.outerbase.io",
  prefix: null,
  namespaces: ["access", "test"],
  methods: ["GET", "POST", "PUT"]
})
