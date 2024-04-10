import cnnSo from "@/stores/connections"
import docsSo from "@/stores/docs"
import { deckCardsSo, drawerCardsSo } from "@/stores/docs/cards"
import { menuSo } from "@/stores/docs/links"
import { buildStore } from "@/stores/docs/utils/factory"
import logSo from "@/stores/log"
import { CnnListStore } from "@/stores/stacks/connection"
import { ViewLogStore } from "@/stores/stacks/log"
import { ViewStore } from "@/stores/stacks/viewBase"
import { DOC_TYPE } from "@/types"
import { loadLocalStorage, saveLocalStorage } from "./storage"
import { delay } from "../time"
import { Session } from "./types"



window.addEventListener("load", async (event) => LoadSession())
//window.addEventListener("beforeunload", async (event) => SaveSession())
window.onerror = (message, url, line, col, error) => {
	logSo.addError(error)
}

export async function SaveSession() {
	const deckStates = deckCardsSo.state.all.map(store => store.getSerialization())
	const drawerStates = drawerCardsSo.state.all.map(store => store.getSerialization())
	const session: Session = {
		allStates: [...deckStates, ...drawerStates],
		deckUuids: deckStates.map(s => s.uuid),
		drawerUuids: drawerStates.map(s => s.uuid),
		menuUuids: menuSo.state.all.map(store => store.state.uuid),
		logs: logSo.state.all,
	}
	saveLocalStorage(session)
}

export async function LoadSession() {

	// altrimenti MSW non funziona
	if (import.meta.env.DEV) await delay(1000)

	const session = loadLocalStorage()
	const { deckStores, drawerStores } = buildCards(session)
	const allStores = [...deckStores, ...drawerStores]

	// BUILD SINGLETONE CARDS
	buildFixedCards(allStores)

	// LOAD ALL CONNECTIONS
	await cnnSo.fetch()

	deckCardsSo.setAll(deckStores)
	//menuSo.setAll(menuStores)
	drawerCardsSo.setAll(drawerStores)

	logSo.add({ body: "STARTUP NUI - load session" })
}

export function ClearSession() {
	localStorage.removeItem("logs")
	localStorage.removeItem("cards-all")
	localStorage.removeItem("cards-deck-uuid")
	localStorage.removeItem("cards-drawer-uuid")
	localStorage.removeItem("links-menu-uuid")
}

function buildCards(session: Session) {
	logSo.setAll(session.logs ?? [])

	// CREAZIONE delle CARDS
	const deckStates = session.deckUuids.map(uuid => session.allStates.find(s => s.uuid == uuid))
	const deckStores = deckStates?.map(state => {
		const store: ViewStore = buildStore({ type: state.type, group: deckCardsSo })
		store?.setSerialization(state)
		return store
	}).filter(s => !!s) ?? []

	const drawerStates = session.drawerUuids.map(uuid => session.allStates.find(s => s.uuid == uuid))
	const drawerStores = drawerStates?.map(state => {
		const store: ViewStore = buildStore({ type: state.type, group: drawerCardsSo })
		store?.setSerialization(state)
		return store
	}).filter(s => !!s) ?? []

	return { deckStores, drawerStores }
}

function buildFixedCards(allStores: ViewStore[]) {
	const fixedCnn = (allStores.find(s => s.state.type == DOC_TYPE.CONNECTIONS) ?? buildStore({ type: DOC_TYPE.CONNECTIONS })) as CnnListStore
	const fixedLogs = (allStores.find(s => s.state.type == DOC_TYPE.LOGS) ?? buildStore({ type: DOC_TYPE.LOGS })) as ViewLogStore
	docsSo.setFixedViews([fixedCnn, fixedLogs])
}