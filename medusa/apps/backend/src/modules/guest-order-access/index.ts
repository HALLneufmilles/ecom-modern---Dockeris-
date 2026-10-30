import { Module } from "@medusajs/framework/utils"
import GuestOrderAccessModuleService from "./service"

export const GUEST_ORDER_ACCESS_MODULE = "guestOrderAccess"

export default Module(GUEST_ORDER_ACCESS_MODULE, {
  service: GuestOrderAccessModuleService,
})
