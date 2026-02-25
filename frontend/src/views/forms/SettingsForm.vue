<template>
	<BaseFormPage :config="config" :id="'Albion Settings'" route="settings" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/albion_settings'
</script>
