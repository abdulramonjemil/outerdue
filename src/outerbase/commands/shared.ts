import { defineCommandsInterface } from "@/outerbase/system/command"

export const SampleCommandsInterface = defineCommandsInterface({
  origin: "https://tired-violet.cmd.outerbase.io",
  prefix: null,
  namespaces: ["access", "test"],
  methods: ["GET", "POST", "PUT"]
})
