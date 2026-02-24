<template>
	<div class="dynamic-form-page">
		<PageHeader
			:title="isNew ? 'New User' : (doc?.name || 'User')"
			backRoute="/users"
		>
			<template #actions>
				<button
					v-if="isNew ? permCanCreate('User') : permCanWrite('User')"
					class="btn btn-primary"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleSave"
				>
					<AppIcon name="save" :size="14" />
					Save
				</button>
				<button
					v-if="canDelete"
					class="btn btn-danger btn-text"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleDelete"
				>
					<AppIcon name="trash" :size="14" />
					Delete
				</button>
			</template>
		</PageHeader>

		<!-- Loading State -->
		<div v-if="docLoading" class="loading-state">
			<AppIcon name="loader" :size="24" :spin="true" />
			<span>Loading...</span>
		</div>

		<!-- Error State -->
		<div v-else-if="docError && !doc && !isNew" class="error-state">
			<AppIcon name="alert-triangle" :size="24" />
			<p>{{ docError }}</p>
			<button class="btn btn-secondary" @click="$router.push('/users')">Back</button>
		</div>

		<!-- Form -->
		<template v-else>
			<!-- Tab Navigation -->
			<div class="form-tabs">
				<button
					v-for="tab in tabs"
					:key="tab.key"
					class="form-tab"
					:class="{ active: activeTab === tab.key }"
					@click="activeTab = tab.key"
				>
					{{ tab.label }}
				</button>
			</div>

			<!-- Tab 1: User Details -->
			<div v-show="activeTab === 'details'" class="form-surface">
				<div class="form-grid">
					<FormField label="Enabled">
						<label class="checkbox-label">
							<input
								type="checkbox"
								:checked="form.enabled"
								@change="form.enabled = $event.target.checked ? 1 : 0"
							/>
							<span>Active</span>
						</label>
					</FormField>

					<FormField label="Email" :required="isNew" :error="validationErrors.email">
						<input
							v-if="isNew"
							type="email"
							class="field-input"
							v-model="form.email"
							placeholder="user@example.com"
						/>
						<input
							v-else
							type="text"
							class="field-input"
							:value="doc?.name || ''"
							disabled
						/>
					</FormField>

					<FormField label="Full Name" :readonly="true">
						<input
							type="text"
							class="field-input"
							:value="form.full_name || ''"
							disabled
						/>
					</FormField>

					<FormField label="Language">
						<select class="field-select" v-model="form.language">
							<option value="">-- Select --</option>
							<option v-for="lang in languageOptions" :key="lang" :value="lang">{{ lang }}</option>
						</select>
					</FormField>

					<FormField label="First Name" :required="true" :error="validationErrors.first_name">
						<input
							type="text"
							class="field-input"
							v-model="form.first_name"
							placeholder="First Name"
						/>
					</FormField>

					<FormField label="Username">
						<input
							type="text"
							class="field-input"
							v-model="form.username"
							placeholder="Username"
						/>
					</FormField>

					<FormField label="Time Zone">
						<select class="field-select" v-model="form.time_zone">
							<option value="">-- Select --</option>
							<option v-for="tz in timezoneOptions" :key="tz" :value="tz">{{ tz }}</option>
						</select>
					</FormField>

					<FormField label="Middle Name">
						<input
							type="text"
							class="field-input"
							v-model="form.middle_name"
							placeholder="Middle Name"
						/>
					</FormField>

					<FormField label="Last Name">
						<input
							type="text"
							class="field-input"
							v-model="form.last_name"
							placeholder="Last Name"
						/>
					</FormField>

					<FormField label="New Password">
						<input
							type="password"
							class="field-input"
							v-model="form.new_password"
							placeholder="Enter new password"
							autocomplete="new-password"
						/>
					</FormField>
				</div>
			</div>

			<!-- Tab 2: Roles & Permissions -->
			<div v-show="activeTab === 'roles'" class="form-surface">
				<div class="roles-grid">
					<label class="role-checkbox">
						<input
							type="checkbox"
							:checked="selectedRoles.has('System Manager')"
							@change="toggleRole('System Manager', $event.target.checked)"
						/>
						<span>System Manager</span>
					</label>
				</div>
			</div>

			<!-- Tab 3: More Information -->
			<div v-show="activeTab === 'more'" class="form-surface">
				<div class="form-grid">
					<FormField label="Gender">
						<select class="field-select" v-model="form.gender">
							<option value="">-- Select --</option>
							<option v-for="g in genderOptions" :key="g" :value="g">{{ g }}</option>
						</select>
					</FormField>

					<FormField label="Phone">
						<input
							type="text"
							class="field-input"
							v-model="form.phone"
							placeholder="Phone"
						/>
					</FormField>

					<FormField label="Mobile No">
						<input
							type="text"
							class="field-input"
							v-model="form.mobile_no"
							placeholder="Mobile No"
						/>
					</FormField>

					<FormField label="Birth Date">
						<input
							type="date"
							class="field-input"
							v-model="form.birth_date"
						/>
					</FormField>

					<FormField label="Location">
						<input
							type="text"
							class="field-input"
							v-model="form.location"
							placeholder="Location"
						/>
					</FormField>

					<FormField label="Interests">
						<textarea
							class="field-input field-textarea"
							v-model="form.interest"
							placeholder="Interests"
							rows="3"
						/>
					</FormField>

					<FormField label="Bio" style="grid-column: 1 / -1">
						<textarea
							class="field-input field-textarea"
							v-model="form.bio"
							placeholder="Bio"
							rows="4"
						/>
					</FormField>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup>
import { ref, reactive, computed, shallowRef, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/shared/PageHeader.vue'
import FormField from '@/components/shared/FormField.vue'
import AppIcon from '@/components/shared/AppIcon.vue'
import { useDoc } from '@/composables/useDoc'
import { useAppToast } from '@/composables/useToast'
import { useAppConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'
import { getList, callMethod } from '@/api/client'

const props = defineProps({ id: { type: String, default: null } })

const router = useRouter()
const confirm = useAppConfirm()
const toast = useAppToast()
const { canCreate: permCanCreate, canWrite: permCanWrite, canDelete: permCanDelete } = usePermissions()

const isNew = computed(() => !props.id)

const tabs = [
	{ key: 'details', label: 'User Details' },
	{ key: 'roles', label: 'Roles & Permissions' },
	{ key: 'more', label: 'More Information' },
]
const activeTab = ref('details')

// Doc composable
const docState = shallowRef(null)
const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

const canDelete = computed(() => {
	if (isNew.value) return false
	if (doc.value?.name === 'Administrator') return false
	if (!permCanDelete('User')) return false
	return true
})

// Form state
const form = reactive({
	enabled: 1,
	email: '',
	first_name: '',
	middle_name: '',
	last_name: '',
	username: '',
	language: '',
	time_zone: '',
	new_password: '',
	role_profile_name: '',
	gender: '',
	phone: '',
	mobile_no: '',
	birth_date: '',
	location: '',
	interest: '',
	bio: '',
})

const validationErrors = reactive({
	email: '',
	first_name: '',
})

// Options loaded from server
const languageOptions = ref([])
const timezoneOptions = ref([])
const roleProfileOptions = ref([])
const allRoles = ref([])
const genderOptions = ref([])
const selectedRoles = reactive(new Set())

// Populate form from loaded doc
function populateForm(data) {
	if (!data) return
	form.enabled = data.enabled ? 1 : 0
	form.email = data.email || data.name || ''
	form.first_name = data.first_name || ''
	form.middle_name = data.middle_name || ''
	form.last_name = data.last_name || ''
	form.full_name = data.full_name || ''
	form.username = data.username || ''
	form.language = data.language || ''
	form.time_zone = data.time_zone || ''
	form.new_password = ''
	form.role_profile_name = data.role_profile_name || ''
	form.gender = data.gender || ''
	form.phone = data.phone || ''
	form.mobile_no = data.mobile_no || ''
	form.birth_date = data.birth_date || ''
	form.location = data.location || ''
	form.interest = data.interest || ''
	form.bio = data.bio || ''

	// Populate roles from child table
	selectedRoles.clear()
	if (Array.isArray(data.roles)) {
		for (const row of data.roles) {
			if (row.role) selectedRoles.add(row.role)
		}
	}
}

async function loadOptions() {
	// Load all options in parallel
	const [langRes, tzRes, rpRes, rolesRes, genderRes] = await Promise.allSettled([
		getList('Language', { fields: ['name'], limit_page_length: 0 }),
		callMethod('frappe.core.doctype.user.user.get_timezones'),
		getList('Role Profile', { fields: ['name'], limit_page_length: 0 }),
		callMethod('frappe.core.doctype.user.user.get_all_roles'),
		getList('Gender', { fields: ['name'], limit_page_length: 0 }),
	])

	if (langRes.status === 'fulfilled') {
		languageOptions.value = (langRes.value.data || []).map(r => r.name)
	}
	if (tzRes.status === 'fulfilled') {
		const tzData = tzRes.value
		timezoneOptions.value = Array.isArray(tzData) ? tzData : (tzData?.timezones || [])
	}
	if (rpRes.status === 'fulfilled') {
		roleProfileOptions.value = (rpRes.value.data || []).map(r => r.name)
	}
	if (rolesRes.status === 'fulfilled') {
		const roles = Array.isArray(rolesRes.value) ? rolesRes.value : []
		allRoles.value = roles.filter(r => r !== 'All' && r !== 'Guest')
	}
	if (genderRes.status === 'fulfilled') {
		genderOptions.value = (genderRes.value.data || []).map(r => r.name)
	}
}

async function onRoleProfileChange() {
	const profile = form.role_profile_name
	if (!profile) return
	try {
		const roles = await callMethod('frappe.core.doctype.user.user.get_role_profile', { role_profile: profile })
		selectedRoles.clear()
		if (Array.isArray(roles)) {
			for (const r of roles) selectedRoles.add(r)
		}
	} catch (_) {
		// ignore
	}
}

function selectAllRoles() {
	for (const role of allRoles.value) selectedRoles.add(role)
}

function unselectAllRoles() {
	selectedRoles.clear()
}

function toggleRole(role, checked) {
	if (checked) {
		selectedRoles.add(role)
	} else {
		selectedRoles.delete(role)
	}
}

function validate() {
	let valid = true
	// Email required for new users
	if (isNew.value) {
		if (!form.email || !form.email.trim()) {
			validationErrors.email = 'Email is required'
			valid = false
		} else {
			validationErrors.email = ''
		}
	}
	if (!form.first_name || !form.first_name.trim()) {
		validationErrors.first_name = 'First Name is required'
		valid = false
	} else {
		validationErrors.first_name = ''
	}
	return valid
}

function buildPayload() {
	const payload = {
		enabled: form.enabled,
		first_name: form.first_name,
		middle_name: form.middle_name,
		last_name: form.last_name,
		username: form.username,
		language: form.language,
		time_zone: form.time_zone,
		role_profile_name: form.role_profile_name,
		gender: form.gender,
		phone: form.phone,
		mobile_no: form.mobile_no,
		birth_date: form.birth_date || null,
		location: form.location,
		interest: form.interest,
		bio: form.bio,
		roles: Array.from(selectedRoles).map(role => ({ role })),
	}
	if (isNew.value) {
		payload.email = form.email
	}
	if (form.new_password) {
		payload.new_password = form.new_password
	}
	return payload
}

async function initDoc() {
	docState.value = useDoc('User')

	if (props.id) {
		await docState.value.load(props.id)
		if (docState.value.doc.value) populateForm(docState.value.doc.value)
	}
}

watch(() => props.id, () => initDoc())
onMounted(() => {
	initDoc()
	loadOptions()
})
watch(doc, val => { if (val) populateForm(val) })

function showError(header, e) {
	confirm.require({
		message: e.message || 'An unknown error occurred.',
		header,
		acceptLabel: 'OK',
		acceptProps: { severity: 'danger' },
	})
}

async function handleSave() {
	if (!validate() || !docState.value) return

	try {
		const result = await docState.value.save(buildPayload(), props.id || null)
		toast.success('Saved', 'User saved successfully')
		if (isNew.value && result?.name) {
			router.replace(`/users/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		showError('Save Failed', e)
	}
}

async function handleDelete() {
	confirm.require({
		message: 'Delete this User? This cannot be undone.',
		header: 'Confirm Delete',
		acceptLabel: 'Delete',
		acceptProps: { severity: 'danger' },
		rejectLabel: 'Keep',
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success('Deleted', 'User deleted')
				router.push('/users')
			} catch (e) {
				showError('Delete Failed', e)
			}
		},
	})
}
</script>

<style scoped>
.dynamic-form-page {
	padding: var(--space-lg);
	max-width: 100%;
}

.loading-state,
.error-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-md);
	padding: var(--space-2xl) 0;
	color: var(--color-text-muted);
	font-size: 0.875rem;
}

.error-state {
	color: var(--color-danger);
}

.error-state p {
	margin: 0;
}

/* ── Tab Navigation ──────────────────────────────────────── */
.form-tabs {
	display: flex;
	gap: 2px;
	margin-bottom: var(--space-lg);
	border-bottom: 2px solid var(--color-border);
	padding-bottom: 0;
}

.form-tab {
	padding: var(--space-sm) var(--space-md);
	font-size: 0.8125rem;
	font-weight: 500;
	color: var(--color-text-secondary);
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	margin-bottom: -2px;
	cursor: pointer;
	transition: color var(--transition-fast), border-color var(--transition-fast);
}

.form-tab:hover {
	color: var(--color-text);
	border-bottom-color: var(--color-border-strong);
}

.form-tab.active {
	color: var(--color-primary);
	border-bottom-color: var(--color-accent);
	font-weight: 600;
}

/* ── Form Surface ────────────────────────────────────────── */
.form-surface {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-left: 3px solid var(--color-accent, #e8a838);
	border-radius: var(--radius-lg);
	padding: var(--space-xl) var(--space-lg);
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.3s ease both;
}

@keyframes surfaceReveal {
	from {
		opacity: 0;
		transform: translateY(6px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.form-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-xs) var(--space-xl);
}

@media (max-width: 600px) {
	.form-grid {
		grid-template-columns: 1fr;
	}
}

/* ── Checkbox ────────────────────────────────────────────── */
.checkbox-label {
	display: inline-flex;
	align-items: center;
	gap: var(--space-sm);
	cursor: pointer;
	font-size: 13px;
	color: var(--color-text);
}

.checkbox-label input[type="checkbox"] {
	width: 16px;
	height: 16px;
	accent-color: var(--color-primary);
}

/* ── Roles Section ───────────────────────────────────────── */
.roles-header {
	display: flex;
	align-items: flex-end;
	gap: var(--space-lg);
	margin-bottom: var(--space-lg);
}

.roles-header .form-field {
	flex: 1;
	max-width: 300px;
}

.roles-actions {
	display: flex;
	gap: var(--space-sm);
	padding-bottom: var(--space-md);
}

.roles-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: var(--space-xs) var(--space-md);
}

.role-checkbox {
	display: inline-flex;
	align-items: center;
	gap: var(--space-sm);
	cursor: pointer;
	font-size: 13px;
	color: var(--color-text);
	padding: 4px 0;
}

.role-checkbox input[type="checkbox"] {
	width: 14px;
	height: 14px;
	accent-color: var(--color-primary);
}

/* ── Textarea ────────────────────────────────────────────── */
.field-textarea {
	resize: vertical;
	min-height: 60px;
	font-family: inherit;
}
</style>
