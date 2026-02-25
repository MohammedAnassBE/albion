<template>
	<BaseFormPage :config="config" :id="id" route="user-listviews" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/user_listview'

defineProps({ id: { type: String, default: null } })
</script>
