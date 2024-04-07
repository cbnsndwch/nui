import strApi from "@/api/streams"
import docSo from "@/stores/docs"
import { COLOR_VAR } from "@/stores/layout"
import viewSetup, { ViewState, ViewStore } from "@/stores/stacks/viewBase"
import { DOC_TYPE, EDIT_STATE } from "@/types"
import { StreamConfig, StreamInfo } from "@/types/Stream"
import { StoreCore, mixStores } from "@priolo/jon"
import { StreamsState, StreamsStore } from "."
import { buildConsumers } from "../consumer/utils/factory"
import { buildStreamMessages } from "./utils/factory"
import { VIEW_SIZE } from "../utils"
import loadBaseSetup, { LoadBaseState, LoadBaseStore } from "../loadBase"



/** STREAM DETAIL */
const setup = {

	state: {
		/** la CONNECTION che contiene sto STREAM */
		connectionId: <string>null,
		/** sono gli stream presenti nella stessa connection di questo */
		allStreams: <string[]>null,
		/** STREAM caricata nella CARD */
		stream: <StreamInfo>null,

		editState: EDIT_STATE.READ,

		//#region VIEWBASE
		colorVar: COLOR_VAR.YELLOW,
		width: 230,
		size: VIEW_SIZE.COMPACT,
		//#endregion
	},

	getters: {

		//#region VIEWBASE
		getTitle: (_: void, store?: ViewStore) => "STREAM DETAIL",
		getSubTitle: (_: void, store?: ViewStore) => (<StreamStore>store).state.stream?.config?.name ?? "--",
		getSerialization: (_: void, store?: ViewStore) => {
			const state = store.state as StreamState
			return {
				...viewSetup.getters.getSerialization(null, store),
				connectionId: state.connectionId,
				stream: state.stream,
				allStream: state.allStreams,
				editState: state.editState,
			}
		},
		//#endregion

		getParentList: (_: void, store?: StreamStore): StreamsStore => store.state.group.find({
			type: DOC_TYPE.STREAMS,
			connectionId: store.state.connectionId,
		} as Partial<StreamsState>) as StreamsStore,

		getConsumerOpen: (_: void, store?: StreamStore)=> store.state.linked?.state.type == DOC_TYPE.CONSUMERS,
		getMessagesOpen: (_: void, store?: StreamStore)=> store.state.linked?.state.type == DOC_TYPE.STREAM_MESSAGES,
	},

	actions: {

		//#region OVERWRITE
		setSerialization: (data: any, store?: ViewStore) => {
			viewSetup.actions.setSerialization(data, store)
			const state = store.state as StreamState
			state.connectionId = data.connectionId
			state.stream = data.stream
			state.allStreams = data.allStreams
			state.editState = data.editState
		},
		onLinked: (_: void, store?: ViewStore) => {
			const cnnStore = store as StreamStore
			// se per questo TYPE c'era un LINK preferienziale aprto lo apre
			const options = docSo.state.cardOptions[store.state.type]
			store.state.docAniDisabled = true
			if (options == DOC_TYPE.CONSUMERS) {
				cnnStore.openConsumers()
			} else if (options == DOC_TYPE.STREAM_MESSAGES) {
				cnnStore.openMessages()
			}
			store.state.docAniDisabled = false
		},

		async fetch(_: void, store?: LoadBaseStore) {
			const s = <StreamStore>store
			const name = s.state.stream.config.name
			const stream = await strApi.get(s.state.connectionId, name, { store, manageAbort: true })
			s.setStream(stream)
			await loadBaseSetup.actions.fetch(_, store)
		},
		//#endregion

		/** load all ENTITY */
		async fetchIfVoid(_: void, store?: StreamStore) {
			if (store.state.editState != EDIT_STATE.NEW && (!store.state.stream?.state || !store.state.stream.state.subjects)) {
				await store.fetch()
			}
			if (!store.state.allStreams) {
				await store.fetchAllStreams()
			}
		},
		async fetchAllStreams(_: void, store?: StreamStore) {
			const parent = store.getParentList()
			const streams = parent?.state.all ?? await strApi.index(store.state.connectionId, { store })
			const allStreams = streams?.map(si => si.config.name) ?? []
			store.setAllStreams(allStreams)
		},
		/** crea un nuovo STREAM-INFO tramite STREAM-CONFIG */
		async save(_: void, store?: StreamStore) {
			let streamSaved: StreamInfo = null
			if (store.state.editState == EDIT_STATE.NEW) {
				streamSaved = await strApi.create(store.state.connectionId, store.state.stream.config, { store })
			} else {
				streamSaved = await strApi.update(store.state.connectionId, store.state.stream.config, { store })
			}
			store.setStream(streamSaved)
			store.getParentList()?.update(streamSaved)
			store.getParentList()?.setSelect(streamSaved.config.name)
			store.setEditState(EDIT_STATE.READ)
		},
		/** reset ENTITY */
		restore: (_: void, store?: StreamStore) => {
			store.fetch()
			store.setEditState(EDIT_STATE.READ)
		},



		/** apertura della CARD CONSUMERS */
		openConsumers(_: void, store?: StreamStore) {
			const isOpen = store.getConsumerOpen()
			const view = !isOpen ? buildConsumers(store.state.connectionId, store.state.stream) : null
			store.state.group.addLink({ view, parent: store, anim: true })
		},
		/** apertura della CARD MESSAGES */
		openMessages(_: void, store?: StreamStore) {
			const isOpen = store.getMessagesOpen()
			const view = !isOpen ? buildStreamMessages(store.state.connectionId, store.state.stream) : null
			store.state.group.addLink({ view, parent: store, anim: true })
		},

	},

	mutators: {
		setStream: (stream: StreamInfo) => ({ stream }),
		setAllStreams: (allStreams: string[]) => ({ allStreams }),
		setStreamConfig: (config: StreamConfig, store?: StreamStore) => ({ stream: { ...store.state.stream, config } }),
		setEditState: (editState: EDIT_STATE) => ({ editState }),
	},
}

export type StreamState = typeof setup.state & ViewState & LoadBaseState
export type StreamGetters = typeof setup.getters
export type StreamActions = typeof setup.actions
export type StreamMutators = typeof setup.mutators
export interface StreamStore extends ViewStore, LoadBaseStore, StoreCore<StreamState>, StreamGetters, StreamActions, StreamMutators {
	state: StreamState
}
const streamSetup = mixStores(viewSetup, loadBaseSetup, setup)
export default streamSetup
