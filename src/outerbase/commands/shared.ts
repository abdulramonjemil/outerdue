import { defineCommandsInterface } from "@/outerbase/controller/command/shared"

export const ProfientaCommandsInterface = defineCommandsInterface({
  origin: "https://tired-violet.cmd.outerbase.io",
  namespaces: ["access", "sync", "test"],
  methods: ["GET", "POST", "PUT"]
})
