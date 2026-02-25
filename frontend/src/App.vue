<template>
	<BaseToast />
	<BaseConfirm />
	<router-view />
</template>

<script setup>
import BaseToast from "@/components/shared/BaseToast.vue"
import BaseConfirm from "@/components/shared/BaseConfirm.vue"
</script>
