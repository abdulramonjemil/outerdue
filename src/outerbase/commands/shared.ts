import { defineCommandInterface } from "@/system/command"

export const SampleCommandInterface = defineCommandInterface({
  origin: "https://some-prefix.cmd.outerbase.io",
  prefix: null,
  namespaces: ["access", "test"],
  methods: ["GET", "POST"]
})
