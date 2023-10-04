import { defineCommandsInterface } from "@/outerbase/system/command/shared"

export const SampleCommandsInterface = defineCommandsInterface({
  origin: "https://tired-violet.cmd.outerbase.io",
  namespaces: ["access", "sync", "test"],
  methods: ["GET", "POST", "PUT"]
})
