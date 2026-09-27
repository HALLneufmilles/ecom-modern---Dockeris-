import { Module } from "@medusajs/framework/utils"
import ManagedMediaModuleService from "./service"

export const MANAGED_MEDIA_MODULE = "managedMedia"

export default Module(MANAGED_MEDIA_MODULE, {
  service: ManagedMediaModuleService,
})
