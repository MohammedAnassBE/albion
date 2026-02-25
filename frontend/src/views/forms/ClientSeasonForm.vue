<template>
	<BaseFormPage :config="config" :id="id" route="client-seasons" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/client_season'

defineProps({ id: { type: String, default: null } })
</script>
